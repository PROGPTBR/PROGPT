import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getOpenAIModel } from '@/lib/llm/openai';
import { z } from 'zod';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { retrieve } from '@/lib/rag/retriever';
import { rerank } from '@/lib/rag/reranker';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { withUser } from '@/lib/observability/user-context';
import { getRunForOwner, updateRunRefineMessages } from '@/lib/assistants/runs';
import { buildRefineSystemForType } from '@/lib/assistants/refine';
import type {
  RfpParams,
  KraljicParams,
  PorterParams,
  FinancialParams,
  AbcParams,
  ProfileParams,
  ScorecardParams,
  AssistantType,
} from '@/lib/assistants/types';
import type { ApiOperation } from '@/lib/observability/api-usage';

export const runtime = 'nodejs';

const MAX_HISTORY = 12; // pairs; older turns dropped to keep context bounded
const RERANK_TOP_N = 6;

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});
const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(MAX_HISTORY * 2),
});

// POST /api/assistants/runs/[id]/chat
// Refinement chat for a completed RFP run. Stateless: client owns the
// message history. Per-turn we re-build system from output_md + retrieved
// chunks (most recent user message drives the retrieval query).
export async function POST(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'invalid body' },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  return withUser(user.id, () => refineBody(parsed, user, params));
}

async function refineBody(
  parsed: z.infer<typeof BodySchema>,
  user: { id: string },
  params: { id: string },
): Promise<Response> {
  const run = await getRunForOwner(params.id, user.id);
  if (!run) return new Response('Not Found', { status: 404 });
  if (run.status !== 'done' || !run.output_md) {
    return Response.json({ error: 'not_ready', status: run.status }, { status: 409 });
  }

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return Response.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const lastUser = [...parsed.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) {
    return Response.json({ error: 'no_user_message' }, { status: 400 });
  }

  const env = process.env.APP_ENV ?? 'production';
  const trace = await startTrace({
    name: 'assistant.rfp.refine',
    userId: user.id,
    input: { runId: run.id, latestUser: lastUser.content.slice(0, 400) },
    tags: [`env:${env}`, 'assistant_type:rfp', 'phase:refine'],
  });

  // Grounding: retrieve+rerank on the latest user question. The RFP itself
  // is injected as system context, so the LLM doesn't need to re-retrieve
  // its own content; only outside theory.
  const retrieveSpan = trace.span('retrieve', { query: lastUser.content });
  const candidates = await retrieve(lastUser.content);
  retrieveSpan.end({ count: candidates.length });

  const rerankSpan = trace.span('rerank', { candidates: candidates.length });
  const chunks = await rerank(lastUser.content, candidates, RERANK_TOP_N);
  rerankSpan.end({ kept: chunks.length, top1Score: chunks[0]?.rerankScore ?? null });

  const system = buildRefineSystemForType(
    run.assistant_type,
    run.output_md,
    run.params as
      | RfpParams
      | KraljicParams
      | PorterParams
      | FinancialParams
      | AbcParams
      | ProfileParams
      | ScorecardParams,
    chunks,
  );

  const refineOp: ApiOperation = (
    {
      kraljic: 'assistant-kraljic-suggest',
      porter: 'assistant-porter-refine',
      financial: 'assistant-financial-refine',
      abc: 'assistant-abc-refine',
      profile: 'assistant-profile-refine',
      scorecard: 'assistant-scorecard-refine',
      rfp: 'assistant-rfp-refine',
    } as Record<AssistantType, ApiOperation>
  )[run.assistant_type];

  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const generateSpan = trace.span('generate', { systemLen: system.length });

  try {
    const result = streamText({
      model: openai(getOpenAIModel('generation')),
      // Mesmo motivo do /api/chat: baixa temperatura pra o refino ficar fiel ao
      // artefato + base e não recusar de forma inconsistente (default 1.0).
      temperature: 0.3,
      system,
      messages: parsed.messages,
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
          chars_out: text.length,
        });
        void recordApiUsage({
          provider: 'openai',
          operation: refineOp,
          model: getOpenAIModel('generation'),
          tokensIn: usage.promptTokens,
          tokensOut: usage.completionTokens,
          tokensCached: cachedPromptTokens,
          metadata: {
            runId: run.id,
            finish_reason: finishReason,
            env,
          },
        });
        // Item 6 — persiste o refine-chat (cliente manda histórico completo;
        // append da resposta do assistant). Fire-and-forget; só grava se a
        // resposta veio limpa, pra não persistir turno vazio/abortado.
        if (text.trim().length > 0) {
          const ts = new Date().toISOString();
          void updateRunRefineMessages(run.id, [
            ...parsed.messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'assistant' as const, content: text, ts },
          ]);
        }
        trace.end({ chars_out: text.length, runId: run.id });
        await flushAsync();
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/assistants/rfp/chat] failed:', err);
    trace.end({ error: message }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'refine_failed' }, { status: 500 });
  }
}
