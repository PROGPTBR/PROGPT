import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { analyzeComprador } from '@/lib/assistants/comprador';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  title: z.string().trim().max(160).optional(),
  supplier_name: z.string().trim().max(160).optional(),
  supplier_email: z.string().trim().email().max(254).optional().or(z.literal('')),
  escopo: z.string().trim().max(8000).optional().default(''),
  propostas: z.string().trim().min(1).max(60000),
  politica: z.string().trim().max(8000).optional().default(''),
});

// POST — analisa as propostas e SALVA a cotação na caixa.
export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid body' },
      { status: 400 },
    );
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

  let analysis;
  let usage;
  let model;
  try {
    const out = await analyzeComprador({
      escopo: parsed.escopo,
      propostas: parsed.propostas,
      politica: parsed.politica,
    });
    analysis = out.result;
    usage = out.usage;
    model = out.model;
  } catch (err) {
    console.error('[comprador/quotes] analyze failed:', err);
    return NextResponse.json({ error: 'analyze_failed' }, { status: 500 });
  }

  void recordApiUsage({
    provider: 'openai',
    operation: 'comprador-analyze',
    model,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    tokensCached: usage.tokensCached,
  });

  const svc = getServerSupabase();
  const { data, error } = await svc
    .from('comprador_quotes')
    .insert({
      user_id: user.id,
      title:
        parsed.title?.trim() ||
        (parsed.supplier_name?.trim()
          ? `Cotação · ${parsed.supplier_name.trim()}`
          : 'Cotação'),
      supplier_name: parsed.supplier_name ?? null,
      supplier_email: parsed.supplier_email || null,
      escopo: parsed.escopo,
      propostas: parsed.propostas,
      politica: parsed.politica,
      analysis,
      severidade: analysis.severidade,
      status: 'analyzed',
      source: 'manual',
    })
    .select()
    .single();

  if (error) {
    console.error('[comprador/quotes] insert failed:', error.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }

  return NextResponse.json({ quote: data });
}

// GET — lista as cotações do usuário (resumo).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = getServerSupabase();
  const { data, error } = await svc
    .from('comprador_quotes')
    .select('id, title, supplier_name, supplier_email, status, severidade, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[comprador/quotes] list failed:', error.message);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
  return NextResponse.json({ quotes: data ?? [] });
}
