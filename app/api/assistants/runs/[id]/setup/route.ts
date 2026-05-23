import { NextResponse } from 'next/server';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { getRunForOwner, updateRunTranscript } from '@/lib/assistants/runs';
import {
  NegotiationSimulatorSetupSchema,
  type NegotiationStrategyParams,
  type NegotiationStrategyResult,
} from '@/lib/assistants/types';
import { generateOpener } from '@/lib/assistants/negotiation/prompt-opener';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/assistants/runs/[id]/setup
// Body: { personaProfile, supplierObjectives, supplierWalkaway }
// Salva o setup no params (merge) e gera a primeira fala da persona.
// Retorna { opener: string } pra cliente injetar no chat.
//
// Por que merge no params: o `assistant_runs.params` original veio do
// Strategy Builder. O setup do simulator vive sob `params.simulator` —
// JSONB, sem mexer no shape do `strategy` que já foi persistido.

export async function POST(
  req: Request,
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

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = NegotiationSimulatorSetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const run = await getRunForOwner(routeParams.id, user.id);
  if (!run || run.assistant_type !== 'negotiation') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Persistir setup dentro de params (merge JSONB) — passo a service-role.
  const merged = {
    ...(run.params as NegotiationStrategyParams),
    simulator: parsed.data,
  };
  const { getServerSupabase } = await import('@/lib/db/supabase');
  await getServerSupabase()
    .from('assistant_runs')
    .update({ params: merged })
    .eq('id', routeParams.id);

  // Gerar opener
  try {
    const opener = await generateOpener({
      params: run.params as NegotiationStrategyParams,
      strategy: (run.strategy ?? null) as NegotiationStrategyResult | null,
      setup: parsed.data,
    });
    // Inicia o transcript com o opener do assistente
    const initialTranscript = [
      {
        role: 'assistant' as const,
        content: opener,
        ts: new Date().toISOString(),
      },
    ];
    await updateRunTranscript(routeParams.id, initialTranscript);
    return NextResponse.json({ opener });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/assistants/runs/setup] failed:', msg);
    return NextResponse.json(
      { error: 'opener_failed', message: msg.slice(0, 200) },
      { status: 500 },
    );
  }
}
