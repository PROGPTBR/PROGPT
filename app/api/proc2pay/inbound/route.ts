import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/db/supabase';
import { verifyResendSignature, fetchReceivedEmailText, fetchInboundAttachmentsText } from '@/lib/email/inbound';
import { userIdFromRecipients } from '@/lib/proc2pay/inbound-alias';
import { structureRequisicaoFromText } from '@/lib/proc2pay/intake';
import { createProcess, processExistsForInboundEmail } from '@/lib/proc2pay/process';
import { isPro } from '@/lib/billing/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Proc2Pay — webhook do Resend Inbound (email.received). O e-mail da produção
// chega no alias proc2pay-<userId>@<domínio> → estrutura a requisição → abre o
// processo. Fail-soft: sempre 200 em casos benignos pro Resend não re-entregar
// em loop.

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

export async function POST(req: Request) {
  const raw = await req.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[proc2pay/inbound] RESEND_WEBHOOK_SECRET ausente');
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

  const { email_id, to, subject, attachments } = payload.data;

  // Mapeia o alias → usuário (determinístico, sem tabela).
  const userId = userIdFromRecipients(to);
  if (!userId) return NextResponse.json({ ok: true, no_match: true });

  // Confirma que o usuário existe (e está apto). Proc2Pay é Pro.
  const svc = getServerSupabase();
  const { data: profile } = await svc.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ ok: true, no_user: true });
  if (!(await isPro(userId))) return NextResponse.json({ ok: true, not_pro: true });

  // Idempotência — Resend re-entrega webhooks.
  if (await processExistsForInboundEmail(userId, email_id)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Corpo + anexos → texto.
  const bodyText = await fetchReceivedEmailText(email_id);
  const attachText = await fetchInboundAttachmentsText(email_id, attachments ?? []);
  const text = [subject, bodyText, attachText].filter((s) => s && s.trim()).join('\n\n').trim();
  if (!text) return NextResponse.json({ ok: true, empty: true });

  const { requisicao, titulo } = await structureRequisicaoFromText(text, userId);
  const created = await createProcess({
    userId,
    requisicao,
    titulo,
    origem: 'email',
    inboundEmailId: email_id,
  });
  if (!created) return NextResponse.json({ error: 'persist_failed' }, { status: 500 });

  return NextResponse.json({ ok: true, processId: created.id });
}
