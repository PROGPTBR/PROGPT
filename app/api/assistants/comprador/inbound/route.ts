import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordApiUsage } from '@/lib/observability/api-usage';
import {
  verifyResendSignature,
  fetchReceivedEmailText,
  fetchInboundAttachmentsText,
} from '@/lib/email/inbound';
import { analyzeComprador } from '@/lib/assistants/comprador';
import { draftSupplierReply, normalizeSettings } from '@/lib/assistants/comprador-inbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InboundPayload = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    attachments?: { id: string; filename?: string; content_type?: string }[];
  };
};

function parseFrom(from: string | undefined): { name: string | null; email: string | null } {
  if (!from) return { name: null, email: null };
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: (m[1] || '').trim() || null, email: m[2]!.trim() };
  const email = from.trim();
  return { name: null, email: email.includes('@') ? email : null };
}

// POST — webhook do Resend Inbound (email.received). Cria a cotação na caixa
// do usuário dono do alias, analisa e (se configurado) rascunha a resposta.
// Nada é enviado automaticamente — resposta sempre passa pela aprovação.
export async function POST(req: Request) {
  const raw = await req.text();

  // 1) Verificação de assinatura (Svix)
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[comprador/inbound] RESEND_WEBHOOK_SECRET ausente');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }
  const ok = verifyResendSignature({
    payload: raw,
    svixId: req.headers.get('svix-id'),
    svixTimestamp: req.headers.get('svix-timestamp'),
    svixSignature: req.headers.get('svix-signature'),
    secret,
  });
  if (!ok) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });

  let payload: InboundPayload;
  try {
    payload = JSON.parse(raw) as InboundPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (payload.type !== 'email.received' || !payload.data?.email_id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { email_id, from, to, subject, attachments } = payload.data;
  const fromParsed = parseFrom(from);
  const svc = getServerSupabase();

  // 2) Mapeia o alias de destino → usuário
  const aliases = (to ?? []).map((t) => t.toLowerCase().trim());
  if (aliases.length === 0) return NextResponse.json({ ok: true, no_recipient: true });
  const { data: settingsRow } = await svc
    .from('comprador_settings')
    .select('*')
    .in('inbound_alias', aliases)
    .maybeSingle();
  if (!settingsRow?.user_id) {
    // Nenhum usuário com esse alias — ignora silenciosamente (200 pro Resend).
    return NextResponse.json({ ok: true, no_match: true });
  }
  const userId = settingsRow.user_id as string;

  // 2b) Confirmação de encaminhamento do Gmail (forwarding-noreply@google.com)
  // cai aqui em vez de na caixa do usuário — guardamos o código/link pra exibir
  // no painel, e NÃO criamos cotação.
  if (fromParsed.email?.toLowerCase() === 'forwarding-noreply@google.com') {
    const confirmText = await fetchReceivedEmailText(email_id);
    const hint = [subject ?? 'Confirmação de encaminhamento do Gmail', confirmText.slice(0, 1500)]
      .filter(Boolean)
      .join('\n\n');
    await svc
      .from('comprador_settings')
      .update({ inbound_confirm: hint, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    return NextResponse.json({ ok: true, gmail_confirmation: true });
  }

  // 3) Idempotência — Resend re-entrega webhooks.
  const { data: dup } = await svc
    .from('comprador_quotes')
    .select('id')
    .eq('inbound_email_id', email_id)
    .maybeSingle();
  if (dup) return NextResponse.json({ ok: true, deduped: true });

  // 4) Busca corpo + anexos
  const bodyText = await fetchReceivedEmailText(email_id);
  const attachText = await fetchInboundAttachmentsText(email_id, attachments ?? []);
  const propostas = [bodyText, attachText].filter((s) => s && s.trim()).join('\n\n').trim();

  // 5) Cria a cotação (idempotência garantida pelo inbound_email_id)
  const { data: quote, error: insErr } = await svc
    .from('comprador_quotes')
    .insert({
      user_id: userId,
      title: subject?.trim() || `Cotação · ${fromParsed.name ?? fromParsed.email ?? 'e-mail'}`,
      supplier_name: fromParsed.name,
      supplier_email: fromParsed.email,
      propostas: propostas || '(sem conteúdo extraível do e-mail)',
      inbound_email_id: email_id,
      source: 'email',
      status: propostas ? 'analyzing' : 'analyzed',
    })
    .select()
    .single();
  if (insErr) {
    console.error('[comprador/inbound] insert failed:', insErr.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }

  // Sem conteúdo analisável → cotação criada, usuário decide manualmente.
  if (!propostas) return NextResponse.json({ ok: true, quoteId: quote.id, empty: true });

  // 6) Analisa
  try {
    const out = await analyzeComprador({ escopo: '', propostas, politica: '' });
    void recordApiUsage({
      provider: 'openai',
      operation: 'comprador-analyze',
      model: out.model,
      tokensIn: out.usage.tokensIn,
      tokensOut: out.usage.tokensOut,
      tokensCached: out.usage.tokensCached,
      userId,
    });
    await svc
      .from('comprador_quotes')
      .update({
        analysis: out.result,
        severidade: out.result.severidade,
        status: 'analyzed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quote.id);

    // 7) Rascunho automático (se configurado) — NÃO envia.
    const settings = normalizeSettings(settingsRow as Record<string, unknown>);
    if (settings.auto_draft) {
      const draft = await draftSupplierReply({
        supplierName: fromParsed.name,
        analysis: out.result,
        settings,
      });
      void recordApiUsage({
        provider: 'openai',
        operation: 'comprador-draft-reply',
        model: draft.model,
        tokensIn: draft.usage.tokensIn,
        tokensOut: draft.usage.tokensOut,
        tokensCached: draft.usage.tokensCached,
        userId,
      });
      await svc.from('comprador_replies').insert({
        quote_id: quote.id,
        user_id: userId,
        to_email: fromParsed.email,
        subject: draft.reply.subject,
        body: draft.reply.body,
        status: 'draft',
      });
      await svc
        .from('comprador_quotes')
        .update({ status: 'awaiting_reply' })
        .eq('id', quote.id);
    }
  } catch (err) {
    // Análise/rascunho falharam — a cotação já existe; usuário pode reanalisar.
    console.error('[comprador/inbound] analyze/draft failed:', err);
  }

  return NextResponse.json({ ok: true, quoteId: quote.id });
}
