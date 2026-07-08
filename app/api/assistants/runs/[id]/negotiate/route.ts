import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getOpenAIModel } from '@/lib/llm/openai';
import { NextResponse } from 'next/server';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { getRunForOwner, updateRunTranscript } from '@/lib/assistants/runs';
import {
  NegotiationTurnRequestSchema,
  NegotiationSimulatorSetupSchema,
  type NegotiationStrategyParams,
  type NegotiationStrategyResult,
  type NegotiationTranscriptTurn,
} from '@/lib/assistants/types';
import { buildPersonaSystem } from '@/lib/assistants/negotiation/prompt-persona';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { withUser } from '@/lib/observability/user-context';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/assistants/runs/[id]/negotiate
// Stateless por turno. Cliente envia { messages: ChatMessage[] }; servidor
// monta system prompt da persona + history + streama resposta. Em
// onFinish persiste o transcript completo (snapshot).
//
// O cliente é a source of truth do histórico durante a sessão; o servidor
// só faz upsert do snapshot no final de cada turno (idempotente).

export async function POST(
  req: Request,
  { params: routeParams }: { params: { id: string } },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return withUser(user.id, () => negotiateBody(req, user, routeParams));
}

async function negotiateBody(
  req: Request,
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = NegotiationTurnRequestSchema.safeParse(body);
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

  // Acesso liberado a todo usuário logado (decisão 2026-07-07: cartão no
  // cadastro ⇒ sem bloqueio de pagamento in-app). Cap de turnos do free tier
  // removido — ver git. O rate-limit (checkChatRateLimit acima) segue como
  // backstop de abuso do simulador.

  // Extrair setup do params.simulator
  const rawParams = run.params as NegotiationStrategyParams & {
    simulator?: unknown;
  };
  const setupParsed = NegotiationSimulatorSetupSchema.safeParse(
    rawParams.simulator,
  );
  if (!setupParsed.success) {
    return NextResponse.json(
      { error: 'setup_missing', message: 'Setup the simulator first' },
      { status: 409 },
    );
  }

  const env = process.env.APP_ENV ?? 'production';
  const trace = await startTrace({
    name: 'assistant.negotiation.turn',
    userId: user.id,
    input: {
      runId: routeParams.id,
      turn: parsed.data.messages.length,
    },
    tags: [`env:${env}`, 'assistant:negotiation', 'phase:turn'],
  });

  const systemPrompt = buildPersonaSystem({
    params: rawParams,
    strategy: (run.strategy ?? null) as NegotiationStrategyResult | null,
    setup: setupParsed.data,
  });

  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const model = getOpenAIModel('generation');
  const generateSpan = trace.span('generate-turn', {
    turn: parsed.data.messages.length,
  });

  const result = streamText({
    model: openai(model),
    system: systemPrompt,
    messages: parsed.data.messages,
    onFinish: async ({ text, usage, finishReason, providerMetadata }) => {
      const cachedPromptTokens = (() => {
        const v = providerMetadata?.openai?.cachedPromptTokens;
        return typeof v === 'number' ? v : 0;
      })();
      generateSpan.end({
        tokens_in: usage.promptTokens,
        tokens_out: usage.completionTokens,
        tokens_cached: cachedPromptTokens,
        finish_reason: finishReason,
      });
      void recordApiUsage({
        provider: 'openai',
        operation: 'assistant-negotiation-turn',
        model,
        tokensIn: usage.promptTokens,
        tokensOut: usage.completionTokens,
        tokensCached: cachedPromptTokens,
        metadata: {
          turn: parsed.data.messages.length,
          finish_reason: finishReason,
          env,
        },
      });

      // Snapshot do transcript após o turno
      const fullTranscript: NegotiationTranscriptTurn[] = [
        ...parsed.data.messages.map((m) => ({
          role: m.role,
          content: m.content,
          ts: undefined,
        })),
        {
          role: 'assistant' as const,
          content: text,
          ts: new Date().toISOString(),
        },
      ];
      await updateRunTranscript(routeParams.id, fullTranscript);
      trace.end({ ok: true });
      await flushAsync();
    },
  });

  return result.toDataStreamResponse();
}
