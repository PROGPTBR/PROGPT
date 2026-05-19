import { getServerSupabase } from '@/lib/db/supabase';

// Sub-projeto 19 — API cost tracking.
//
// recordApiUsage() is the single write path that lands rows in
// `api_usage_events`. Every external LLM/embedding/rerank call site instruments
// itself here so /admin/costs can roll up spend.
//
// **Fire-and-forget by design.** A cost-tracking failure must not break the
// chat or ingest pipeline. recordApiUsage() catches every error internally
// and logs a warning. The Promise it returns is always resolved.

export type ApiProvider = 'openai' | 'voyage' | 'cohere';

// Operation labels — free form by convention but stable for the dashboard.
// Add new labels here AND in lib/observability/api-usage.ts cost calc if
// the new operation has a different rate.
export type ApiOperation =
  | 'chat-generate'
  | 'chat-title-summarize'
  | 'classify'
  | 'condense'
  | 'followups'
  | 'classify-content'
  | 'multimodal-parse'
  | 'embed'
  | 'rerank'
  | 'assistant-rfp-generate'
  | 'assistant-rfp-refine'
  | 'assistant-rfp-apply'
  | 'assistant-kraljic-generate'
  | 'assistant-kraljic-suggest';

export type RecordUsageInput = {
  provider: ApiProvider;
  operation: ApiOperation;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  tokensCached?: number;
  callCount?: number;
  metadata?: Record<string, unknown>;
};

// ── Rate cards (USD per 1M tokens unless noted) ─────────────────────────────
// Frozen at write time — historical rows keep the cost computed when they
// were inserted. To bump a rate, add a new branch keyed by date; do NOT
// rewrite historical events.

// OpenAI gpt-4o-mini (default model — getOpenAIModel())
// As of 2026-05: $0.15 input / $0.075 cached input / $0.60 output per 1M tok.
const OPENAI_GPT4O_MINI = {
  inputPerM: 0.15,
  cachedInputPerM: 0.075,
  outputPerM: 0.6,
};

// Voyage voyage-3-large: $0.18 per 1M tokens.
const VOYAGE_LARGE_PER_M = 0.18;

// Cohere rerank-multilingual-v3.0: $2.00 per 1k searches (per call_count,
// not per token). One "search" = one (query, documents[]) call regardless
// of how many docs you rerank in it.
const COHERE_RERANK_PER_CALL = 2.0 / 1000;

/**
 * Compute estimated cost in USD cents for a given API usage event. Pure
 * function — easy to unit test. Adjust the rate constants above when
 * provider pricing changes.
 */
export function computeCostUsdCents(input: RecordUsageInput): number {
  const tIn = input.tokensIn ?? 0;
  const tOut = input.tokensOut ?? 0;
  const tCached = input.tokensCached ?? 0;
  const calls = input.callCount ?? 1;

  if (input.provider === 'openai') {
    // Cached input is billed at half rate. The cached count is part of
    // tokens_in already (OpenAI reports them separately for visibility),
    // so we split: cached at half, the rest at full.
    const uncachedIn = Math.max(0, tIn - tCached);
    const usd =
      (uncachedIn / 1_000_000) * OPENAI_GPT4O_MINI.inputPerM +
      (tCached / 1_000_000) * OPENAI_GPT4O_MINI.cachedInputPerM +
      (tOut / 1_000_000) * OPENAI_GPT4O_MINI.outputPerM;
    return usd * 100;
  }

  if (input.provider === 'voyage') {
    const usd = (tIn / 1_000_000) * VOYAGE_LARGE_PER_M;
    return usd * 100;
  }

  if (input.provider === 'cohere') {
    const usd = calls * COHERE_RERANK_PER_CALL;
    return usd * 100;
  }

  return 0;
}

export async function recordApiUsage(input: RecordUsageInput): Promise<void> {
  try {
    const sb = getServerSupabase();
    const cost = computeCostUsdCents(input);
    const { error } = await sb.from('api_usage_events').insert({
      provider: input.provider,
      operation: input.operation,
      model: input.model ?? null,
      tokens_in: input.tokensIn ?? 0,
      tokens_out: input.tokensOut ?? 0,
      tokens_cached: input.tokensCached ?? 0,
      call_count: input.callCount ?? 1,
      cost_usd_cents: cost,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.warn('[api-usage] insert failed:', error.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[api-usage] recordApiUsage swallowed error:', message);
  }
}
