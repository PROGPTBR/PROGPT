import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { getProcessForOwner } from '@/lib/proc2pay/process';
import { runStage } from '@/lib/proc2pay/orchestrator';
import type { StageId } from '@/lib/proc2pay/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Proc2Pay — executa uma etapa do processo (owner-only + rate limit do chat).
// Os sub-assistentes NÃO consomem o limite free aqui — o paywall foi cobrado na
// abertura do processo (feature Pro).

const Payload = z.object({
  propostas: z.string().trim().max(60000).optional(),
  nota: z.string().trim().max(4000).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string; stage: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  const process = await getProcessForOwner(user.id, params.id);
  if (!process) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let payload: z.infer<typeof Payload> = {};
  try {
    const raw = await req.json().catch(() => ({}));
    payload = Payload.parse(raw ?? {});
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const result = await runStage({
    userId: user.id,
    process,
    stage: params.stage as StageId,
    payload,
  });

  if (!result.ok) {
    const status = result.code === 'not_runnable' ? 409 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ process: result.process, artifactMd: result.artifactMd });
}
