import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { draftSupplierReply, normalizeSettings } from '@/lib/assistants/comprador-inbox';
import type { CompradorResult } from '@/lib/assistants/comprador';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  instruction: z.string().trim().max(1000).optional(),
});

// POST — gera um RASCUNHO de resposta ao fornecedor (não envia; aprovação humana).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse((await req.json().catch(() => ({}))) ?? {});
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const svc = getServerSupabase();
  const { data: quote } = await svc
    .from('comprador_quotes')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!quote.analysis) {
    return NextResponse.json({ error: 'no_analysis' }, { status: 400 });
  }

  const { data: settingsRow } = await svc
    .from('comprador_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  const settings = normalizeSettings(settingsRow as Record<string, unknown> | null);

  let reply;
  let usage;
  let model;
  try {
    const out = await draftSupplierReply({
      supplierName: quote.supplier_name,
      analysis: quote.analysis as CompradorResult,
      settings,
      escopo: quote.escopo ?? '',
      instruction: parsed.instruction,
    });
    reply = out.reply;
    usage = out.usage;
    model = out.model;
  } catch (err) {
    console.error('[comprador/draft] failed:', err);
    return NextResponse.json({ error: 'draft_failed' }, { status: 500 });
  }

  void recordApiUsage({
    provider: 'openai',
    operation: 'comprador-draft-reply',
    model,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    tokensCached: usage.tokensCached,
  });

  const { data: saved, error } = await svc
    .from('comprador_replies')
    .insert({
      quote_id: quote.id,
      user_id: user.id,
      to_email: quote.supplier_email ?? null,
      subject: reply.subject,
      body: reply.body,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('[comprador/draft] persist failed:', error.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }

  await svc
    .from('comprador_quotes')
    .update({ status: 'awaiting_reply', updated_at: new Date().toISOString() })
    .eq('id', quote.id)
    .eq('user_id', user.id);

  return NextResponse.json({ reply: saved });
}
