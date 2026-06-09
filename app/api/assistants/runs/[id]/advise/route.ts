import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getOpenAIModel } from '@/lib/llm/openai';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { getRunForOwner } from '@/lib/assistants/runs';
import {
  NegotiationSimulatorSetupSchema,
  type NegotiationStrategyParams,
  type NegotiationStrategyResult,
} from '@/lib/assistants/types';
import {
  buildCoachSystem,
  buildCoachUser,
} from '@/lib/assistants/negotiation/prompt-coach';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { withUser } from '@/lib/observability/user-context';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/assistants/runs/[id]/advise — sub-projeto 34 (coach inline).
//
// "Timeout" tático durante o ensaio: o LLM sai do papel de fornecedor e vira
// coach do COMPRADOR (prompt-coach). Recebe só as mensagens da negociação
// (client filtra as do próprio coach) + pergunta opcional. NÃO persiste nada —
// o conselho é efêmero e nunca entra no transcript que o /close pontua.

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(16000),
      }),
    )
    .max(100),
  question: z.string().trim().max(1000).optional(),
});

export async function POST(
  req: Request,
  { params: routeParams }: { params: { id: string } },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withUser(user.id, () => adviseBody(req, user, routeParams));
}

async function adviseBody(
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

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const run = await getRunForOwner(routeParams.id, user.id);
  if (!run || run.assistant_type !== 'negotiation') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

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
    name: 'assistant.negotiation.advise',
    userId: user.id,
    input: { runId: routeParams.id, turns: body.messages.length },
    tags: [`env:${env}`, 'assistant:negotiation', 'phase:advise'],
  });

  const system = buildCoachSystem({
    params: rawParams,
    strategy: (run.strategy ?? null) as NegotiationStrategyResult | null,
    setup: setupParsed.data,
  });
  const userMsg = buildCoachUser(body.messages, body.question);

  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const model = getOpenAIModel('generation');
  const span = trace.span('generate-advice', { turns: body.messages.length });

  const result = streamText({
    model: openai(model),
    system,
    messages: [{ role: 'user', content: userMsg }],
    onFinish: async ({ text, usage, finishReason, providerMetadata }) => {
      const cachedPromptTokens = (() => {
        const v = providerMetadata?.openai?.cachedPromptTokens;
        return typeof v === 'number' ? v : 0;
      })();
      span.end({
        tokens_in: usage.promptTokens,
        tokens_out: usage.completionTokens,
        tokens_cached: cachedPromptTokens,
        finish_reason: finishReason,
        advice_chars: text.length,
      });
      void recordApiUsage({
        provider: 'openai',
        operation: 'assistant-negotiation-advise',
        model,
        tokensIn: usage.promptTokens,
        tokensOut: usage.completionTokens,
        tokensCached: cachedPromptTokens,
        metadata: { finish_reason: finishReason, env },
      });
      trace.end({ ok: true });
      await flushAsync();
    },
  });

  return result.toDataStreamResponse();
}
