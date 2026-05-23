import { NextResponse } from 'next/server';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { getRunForOwner, updateRunScore } from '@/lib/assistants/runs';
import {
  NegotiationSimulatorSetupSchema,
  type NegotiationStrategyParams,
  type NegotiationStrategyResult,
  type NegotiationTranscriptTurn,
} from '@/lib/assistants/types';
import { generateScore } from '@/lib/assistants/negotiation/prompt-score';
import { withUser } from '@/lib/observability/user-context';

export const runtime = 'nodejs';
export const maxDuration = 90;

// POST /api/assistants/runs/[id]/close
// Encerra a simulação: analisa transcript completo, gera NegotiationScore
// (0-100 + 4 dimensões + bullets), persiste em assistant_runs.score.
// Idempotente — pode ser chamado várias vezes; sempre gera score fresco.

export async function POST(
  _req: Request,
  { params: routeParams }: { params: { id: string } },
): Promise<Response> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  return withUser(user.id, () => closeBody(user, routeParams));
}

async function closeBody(
  user: { id: string },
  routeParams: { id: string },
): Promise<Response> {
  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  const run = await getRunForOwner(routeParams.id, user.id);
  if (!run || run.assistant_type !== 'negotiation') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const transcript = (run.transcript ?? []) as NegotiationTranscriptTurn[];
  if (transcript.length < 2) {
    return NextResponse.json(
      { error: 'transcript_empty', message: 'Negociação muito curta para avaliar.' },
      { status: 409 },
    );
  }

  const rawParams = run.params as NegotiationStrategyParams & {
    simulator?: unknown;
  };
  const setupParsed = NegotiationSimulatorSetupSchema.safeParse(
    rawParams.simulator,
  );
  if (!setupParsed.success) {
    return NextResponse.json(
      { error: 'setup_missing' },
      { status: 409 },
    );
  }

  try {
    const score = await generateScore({
      params: rawParams,
      strategy: (run.strategy ?? null) as NegotiationStrategyResult | null,
      setup: setupParsed.data,
      transcript,
    });
    await updateRunScore(routeParams.id, score);
    return NextResponse.json({ score });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/assistants/runs/close] failed:', msg);
    return NextResponse.json(
      { error: 'score_failed', message: msg.slice(0, 200) },
      { status: 500 },
    );
  }
}
