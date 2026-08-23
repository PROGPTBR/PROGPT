import OpenAI from 'openai';
import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';
import { requireEnv } from '@/lib/env';

const TIMEOUT_MS = 30_000;

let instance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (instance) return instance;
  const apiKey = requireEnv('OPENAI_API_KEY');
  instance = new OpenAI({ apiKey });
  return instance;
}

let streamingInstance: OpenAIProvider | null = null;

/**
 * Vercel AI SDK provider for `streamText()` call sites. `compatibility:
 * 'strict'` is load-bearing, not cosmetic: without it `@ai-sdk/openai` never
 * sends `stream_options.include_usage` to OpenAI, so streaming responses
 * never carry a `usage` chunk and `onFinish`'s `usage.promptTokens` /
 * `usage.completionTokens` come back as `NaN`. That NaN gets JSON-serialized
 * to `null`, which then violates the NOT NULL constraint on
 * `api_usage_events.tokens_in`/`tokens_out` and `recordApiUsage` swallows
 * the insert error — every `chat-generate` / `assistant-*-generate` /
 * refine / negotiate row was silently dropped until this was added
 * (found 2026-08-23, zero rows for those operations since sub-projeto 19).
 * `getOpenAI()` above (non-streaming `generateObject`/`generateText`) is
 * unaffected — OpenAI always includes usage on non-streaming responses.
 */
export function getStreamingOpenAI(): OpenAIProvider {
  if (streamingInstance) return streamingInstance;
  const apiKey = requireEnv('OPENAI_API_KEY');
  streamingInstance = createOpenAI({ apiKey, compatibility: 'strict' });
  return streamingInstance;
}

export type ModelTier = 'generation' | 'routing' | 'multimodal';

const TIER_ENV: Record<ModelTier, string> = {
  generation: 'OPENAI_MODEL_GENERATION',
  routing: 'OPENAI_MODEL_ROUTING',
  multimodal: 'OPENAI_MODEL_MULTIMODAL',
};

/**
 * Resolve the OpenAI model id for a given call-site tier.
 *
 * Chained fallback: `OPENAI_MODEL_<TIER>` -> `OPENAI_MODEL` -> `'gpt-4o-mini'`.
 * Empty-string envs are treated as unset (`||`, not `??`) so a blank
 * Railway/CI var falls through the chain instead of resolving to `''`.
 *
 * The default tier is `'routing'` — the cheapest tier — so a call-site that
 * forgets to annotate never silently inherits an expensive generation model.
 * With all three `OPENAI_MODEL_*` envs empty, every tier resolves identically
 * to the previous single-model behavior (`OPENAI_MODEL ?? gpt-4o-mini`), so
 * this refactor is a no-op until an operator sets a tier env.
 *
 * Tiers:
 * - `generation`  — user-facing answers/artifacts (chat, assistant generate/refine,
 *   extractors, negotiation). Quality-sensitive; worth a stronger model.
 * - `multimodal`  — PDF table/figure extraction on ingest. Errors contaminate
 *   retrieval permanently; admin-driven batch, latency-insensitive.
 * - `routing`     — short-JSON internal tasks (classify, condense, followups,
 *   title). High volume, low sensitivity; keep cheap.
 */
export function getOpenAIModel(tier: ModelTier = 'routing'): string {
  return process.env[TIER_ENV[tier]] || process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

/**
 * Wrap a single OpenAI call with one retry on 429 (TPM rate limit), honoring
 * the SDK's "try again in Xs" hint. Other errors (network, 5xx, validation)
 * are re-thrown immediately so the caller's fallback path can take over.
 *
 * Used by every OpenAI call site that runs during ingest, since admin batch
 * uploads can saturate the default-tier 200 k tok/min limit. One retry is
 * usually enough; a second 429 means the bucket is fully drained and the
 * caller should fall back rather than stack more waits.
 */
export async function withRateLimitRetry<T>(
  call: () => Promise<T>,
  signal: AbortSignal,
  label: string,
): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (!isRateLimit(err)) throw err;
    const waitMs = rateLimitWaitMs(err);
    console.warn(`[${label}] 429 rate limit; waiting ${waitMs}ms before single retry`);
    await new Promise((r) => setTimeout(r, waitMs));
    if (signal.aborted) throw err;
    return await call();
  }
}

function rateLimitWaitMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : '';
  const m = msg.match(/try again in ([0-9.]+)s/i);
  const secs = m ? Number(m[1]) : NaN;
  return Number.isFinite(secs) ? Math.ceil(secs * 1000) + 500 : 5_000;
}

function isRateLimit(err: unknown): boolean {
  const e = err as { status?: number; code?: string } | null;
  return e?.status === 429 || e?.code === 'rate_limit_exceeded';
}

export async function pingOpenAI(): Promise<string> {
  const ai = getOpenAI();
  const model = getOpenAIModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await ai.chat.completions.create(
      {
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_completion_tokens: 8,
      },
      { signal: controller.signal },
    );
    return res.choices[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}
