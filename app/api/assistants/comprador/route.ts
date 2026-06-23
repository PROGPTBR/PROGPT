import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { analyzeComprador, CompradorInputSchema } from '@/lib/assistants/comprador';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/assistants/comprador
// Body: { escopo?, propostas, politica? }
// Returns: CompradorResult (ranking/TCO, desvios de política, PO rascunho, HITL)
export async function POST(req: Request) {
  let parsed;
  try {
    parsed = CompradorInputSchema.parse(await req.json());
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

  try {
    const { result } = await analyzeComprador(parsed);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'comprador_failed';
    console.error('[api/assistants/comprador] failed:', err);
    return NextResponse.json({ error: 'comprador_failed', detail: message }, { status: 500 });
  }
}
