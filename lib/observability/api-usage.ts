import { getServerSupabase } from '@/lib/db/supabase';
import { currentUserId } from '@/lib/observability/user-context';

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
  | 'chat-attachment-parse'
  | 'chat-attachment-vision'
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
  | 'assistant-kraljic-suggest'
  | 'assistant-porter-generate'
  | 'assistant-porter-refine'
  | 'assistant-porter-apply'
  | 'assistant-financial-generate'
  | 'assistant-financial-refine'
  | 'assistant-financial-apply'
  | 'assistant-financial-extract'
  | 'assistant-abc-generate'
  | 'assistant-abc-refine'
  | 'assistant-abc-apply'
  | 'assistant-profile-generate'
  | 'assistant-profile-refine'
  | 'assistant-profile-apply'
  | 'assistant-profile-extract'
  | 'suppliers-classify-cnae'
  | 'suppliers-search'
  | 'suppliers-export'
  | 'suppliers-cnae-search'
  | 'chat-transcribe'
  | 'assistant-negotiation-strategy'
  | 'assistant-negotiation-example'
  | 'assistant-negotiation-opener'
  | 'assistant-negotiation-turn'
  | 'assistant-negotiation-score'
  | 'assistant-negotiation-speak'
  | 'assistant-negotiation-advise'
  | 'chat-voice-realtime'
  | 'assistant-scorecard-generate'
  | 'assistant-scorecard-refine'
  | 'assistant-scorecard-apply'
  | 'assistant-homologacao-generate'
  | 'assistant-homologacao-reputacao'
  | 'assistant-pesquisa-precos-generate'
  | 'govdata-catmat-pick'
  | 'comprador-analyze'
  | 'comprador-draft-reply'
  | 'assistant-indicadores-leitura'
  | 'assistant-spend-extract'
  | 'assistant-spend-classify'
  | 'assistant-spend-generate'
  | 'assistant-spend-refine';

export type RecordUsageInput = {
  provider: ApiProvider;
  operation: ApiOperation;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  tokensCached?: number;
  callCount?: number;
  metadata?: Record<string, unknown>;
  /**
   * UUID do usuário responsável pela chamada. Opcional: quando ausente,
   * `recordApiUsage` resolve via `currentUserId()` (AsyncLocalStorage
   * setado por `withUser()` no entry da route). Chamadas em background
   * jobs sem user context gravam `null`.
   */
  userId?: string | null;
};

// ── Rate cards (USD per 1M tokens unless noted) ─────────────────────────────
// Frozen at write time — historical rows keep the cost computed when they
// were inserted. To bump a rate, add a new branch keyed by date; do NOT
// rewrite historical events.

// OpenAI chat/responses rate cards (USD per 1M tokens). Frozen at write time.
// As of 2026-06. ADD A NEW MODEL'S RATE HERE (with date) BEFORE setting it in
// any OPENAI_MODEL_* env — otherwise cost is estimated at the conservative
// fallback below, not the true rate.
type OpenAiRate = { inputPerM: number; cachedInputPerM: number; outputPerM: number };

// gpt-4o-mini: $0.15 input / $0.075 cached / $0.60 output
const RATE_GPT4O_MINI: OpenAiRate = { inputPerM: 0.15, cachedInputPerM: 0.075, outputPerM: 0.6 };
// gpt-4o: $2.50 input / $1.25 cached / $10 output (~16x mini)
const RATE_GPT4O: OpenAiRate = { inputPerM: 2.5, cachedInputPerM: 1.25, outputPerM: 10 };
// gpt-5.4-mini (sub-projeto 32 — tier de geração desde 2026-06): $0.75 in / $0.075 cached / $4.50 out
const RATE_GPT54_MINI: OpenAiRate = { inputPerM: 0.75, cachedInputPerM: 0.075, outputPerM: 4.5 };
// gpt-5.4: $2.50 in / $0.25 cached / $15 out
const RATE_GPT54: OpenAiRate = { inputPerM: 2.5, cachedInputPerM: 0.25, outputPerM: 15 };
// gpt-5.5: $5 in / $0.50 cached / $30 out
const RATE_GPT55: OpenAiRate = { inputPerM: 5, cachedInputPerM: 0.5, outputPerM: 30 };

const OPENAI_RATES: Record<string, OpenAiRate> = {
  'gpt-4o-mini': RATE_GPT4O_MINI,
  'gpt-4o': RATE_GPT4O,
  'gpt-5.4-mini': RATE_GPT54_MINI,
  'gpt-5.4': RATE_GPT54,
  'gpt-5.5': RATE_GPT55,
};

// Most expensive known rate — conservative fallback for an unlisted model so
// /admin/costs over- (never under-) bills until its rate is added above.
const RATE_FALLBACK: OpenAiRate = Object.values(OPENAI_RATES).reduce(
  (a, b) => (b.outputPerM > a.outputPerM ? b : a),
  RATE_GPT4O_MINI,
);

// Resolve a rate by model string. Prefix-aware so versioned ids
// ('gpt-4o-mini-2024-07-18', 'gpt-4o-2024-11-20') match. Order matters:
// 'gpt-4o-mini' is a prefix-superset of 'gpt-4o', so check mini FIRST.
//  - empty/missing model => historical mini default (untracked legacy rows)
//  - unknown non-empty model => RATE_FALLBACK (most expensive known)
function openAiRate(model: string | undefined): OpenAiRate {
  const m = (model ?? '').trim();
  if (m === '') return RATE_GPT4O_MINI;
  if (m.startsWith('gpt-4o-mini')) return RATE_GPT4O_MINI;
  if (m.startsWith('gpt-4o')) return RATE_GPT4O;
  // gpt-5.x — order: mini antes do full (mini é prefixo-superset do 5.4 base).
  if (m.startsWith('gpt-5.4-mini')) return RATE_GPT54_MINI;
  if (m.startsWith('gpt-5.4')) return RATE_GPT54;
  if (m.startsWith('gpt-5.5')) return RATE_GPT55;
  return OPENAI_RATES[m] ?? RATE_FALLBACK;
}

// Voyage voyage-3-large: $0.18 per 1M tokens.
const VOYAGE_LARGE_PER_M = 0.18;

// Cohere rerank-multilingual-v3.0: $2.00 per 1k searches (per call_count,
// not per token). One "search" = one (query, documents[]) call regardless
// of how many docs you rerank in it.
const COHERE_RERANK_PER_CALL = 2.0 / 1000;

// OpenAI Whisper-1: $0.006 per minute of audio. Custo é tracked usando
// `tokensIn` como SEGUNDOS de áudio (reuso da coluna; metadata indica
// `duration_secs`). É o único caso em que tokensIn não é tokens — abuso
// deliberado pra evitar migration de schema só pra essa op.
const OPENAI_WHISPER_PER_MIN = 0.006;

// gpt-4o-mini-tts (sub-projeto 34, modo voz da negociação): $0.60/1M tokens de
// texto de input + ~$0.015/min de áudio gerado (tarifa do lançamento 2025-03,
// não listada na pricing page de 2026-06 — manter conservador). A API de
// speech NÃO retorna usage; o call site grava tokensIn = ceil(chars/4).
// Estimamos a duração por chars/600/min (fala PT real ~750-900 chars/min →
// superestima ~25-50%, ou seja, SOBRE-fatura; nunca sub-fatura).
const TTS_TEXT_INPUT_PER_M = 0.6;
const TTS_AUDIO_PER_MIN = 0.015;
const TTS_CHARS_PER_MIN = 600;

// gpt-realtime-mini (sub-projeto 35, assistente de voz do chat) — tarifa do
// lançamento 2025-10 (não listada na pricing page de 2026-06; gpt-realtime-2
// full é $32/$64 áudio). USD por 1M tokens. O usage da sessão é reportado pelo
// client com split por modalidade no metadata; sem split, o fallback trata
// TUDO como áudio (a modalidade mais cara — sobre-fatura, nunca sub-fatura).
const REALTIME_MINI_AUDIO_IN_PER_M = 10;
const REALTIME_MINI_AUDIO_OUT_PER_M = 20;
const REALTIME_MINI_TEXT_IN_PER_M = 0.6;
const REALTIME_MINI_TEXT_OUT_PER_M = 2.4;
const REALTIME_MINI_CACHED_IN_PER_M = 0.3;

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
    // Whisper bills per audio minute, não por token. tokensIn aqui é
    // segundos de áudio (ver comentário na rate card).
    if (input.operation === 'chat-transcribe') {
      const durationSecs = tIn;
      const usd = (durationSecs / 60) * OPENAI_WHISPER_PER_MIN;
      return usd * 100;
    }

    // Realtime voz-a-voz (assistente de voz do chat): split por modalidade
    // vem no metadata (audio_in/audio_out/text_in/text_out/cached_in tokens).
    // Sem split, trata tokensIn/Out inteiros como áudio (conservador).
    if (input.operation === 'chat-voice-realtime') {
      const md = (input.metadata ?? {}) as Record<string, unknown>;
      const n = (k: string) => (typeof md[k] === 'number' && md[k] >= 0 ? (md[k] as number) : 0);
      const audioIn = n('audio_in');
      const audioOut = n('audio_out');
      const textIn = n('text_in');
      const textOut = n('text_out');
      const cachedIn = n('cached_in');
      const hasSplit = audioIn + audioOut + textIn + textOut + cachedIn > 0;
      const usd = hasSplit
        ? (audioIn / 1_000_000) * REALTIME_MINI_AUDIO_IN_PER_M +
          (audioOut / 1_000_000) * REALTIME_MINI_AUDIO_OUT_PER_M +
          (textIn / 1_000_000) * REALTIME_MINI_TEXT_IN_PER_M +
          (textOut / 1_000_000) * REALTIME_MINI_TEXT_OUT_PER_M +
          (cachedIn / 1_000_000) * REALTIME_MINI_CACHED_IN_PER_M
        : (tIn / 1_000_000) * REALTIME_MINI_AUDIO_IN_PER_M +
          (tOut / 1_000_000) * REALTIME_MINI_AUDIO_OUT_PER_M;
      return usd * 100;
    }

    // TTS (modo voz da negociação): texto de input por token + áudio gerado
    // por minuto estimado a partir dos chars (tokensIn = ceil(chars/4)).
    if (input.operation === 'assistant-negotiation-speak') {
      const chars = tIn * 4;
      const usd =
        (tIn / 1_000_000) * TTS_TEXT_INPUT_PER_M +
        (chars / TTS_CHARS_PER_MIN) * TTS_AUDIO_PER_MIN;
      return usd * 100;
    }

    // Rate depends on the model (tiering may set gpt-4o on some call-sites).
    const rate = openAiRate(input.model);
    // Cached input is billed at half rate. The cached count is part of
    // tokens_in already (OpenAI reports them separately for visibility),
    // so we split: cached at half, the rest at full.
    const uncachedIn = Math.max(0, tIn - tCached);
    const usd =
      (uncachedIn / 1_000_000) * rate.inputPerM +
      (tCached / 1_000_000) * rate.cachedInputPerM +
      (tOut / 1_000_000) * rate.outputPerM;
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
    const userId =
      input.userId !== undefined ? input.userId : currentUserId();
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
      user_id: userId,
    });
    if (error) {
      console.warn('[api-usage] insert failed:', error.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[api-usage] recordApiUsage swallowed error:', message);
  }
}
