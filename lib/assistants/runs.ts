import { getServerSupabase } from '@/lib/db/supabase';
import type {
  AssistantRunRow,
  AssistantType,
  RefineMessage,
  RfpParams,
  KraljicParams,
  PorterParams,
  FinancialParams,
  AbcParams,
  ProfileParams,
  NegotiationStrategyParams,
  NegotiationStrategyResult,
  NegotiationScore,
  NegotiationTranscriptTurn,
  SpendAnalysisParams,
} from './types';

// Service-role CRUD for assistant_runs. The API route owns the lifecycle:
// createRun() at request start, updateRunOutput() in onFinish on success,
// failRun() in catch. RLS policies are defense-in-depth — they let the
// docx download route safely fall through to ownership check.

export async function createRun(input: {
  userId: string;
  assistantType: AssistantType;
  templateId: string | null;
  params:
    | RfpParams
    | KraljicParams
    | PorterParams
    | FinancialParams
    | AbcParams
    | ProfileParams
    | NegotiationStrategyParams
    | SpendAnalysisParams;
  traceId: string | null;
}): Promise<AssistantRunRow | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('assistant_runs')
    .insert({
      user_id: input.userId,
      assistant_type: input.assistantType,
      template_id: input.templateId,
      params: input.params,
      trace_id: input.traceId,
      status: 'running',
    })
    .select('*')
    .single();
  if (error) {
    console.warn('[assistants/runs] createRun failed:', error.message);
    return null;
  }
  return data as AssistantRunRow;
}

export async function updateRunOutput(
  id: string,
  outputMd: string,
): Promise<boolean> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from('assistant_runs')
    .update({
      output_md: outputMd,
      status: 'done',
      finished_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.warn('[assistants/runs] updateRunOutput failed:', error.message);
    return false;
  }
  return true;
}

export async function failRun(id: string, errorMessage: string): Promise<boolean> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from('assistant_runs')
    .update({
      status: 'error',
      error_message: errorMessage.slice(0, 500),
      finished_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.warn('[assistants/runs] failRun failed:', error.message);
    return false;
  }
  return true;
}

// Thinner row shape for the history list — drops output_md (can be tens
// of KB) so we can fetch ~50 rows cheaply.
export type AssistantRunSummary = {
  id: string;
  assistant_type: AssistantType;
  template_id: string | null;
  params: RfpParams;
  status: 'running' | 'done' | 'error';
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
};

// Owner-scoped paginated list. Most recent first. Caps `limit` at 200 to
// keep the JSON payload bounded. `cursor` (optional) is the `created_at`
// of the last item from the previous page — rows with `created_at <
// cursor` are returned. `assistantType` (optional) narrows by kind, used
// by UseProfilePicker. Used by /assistants/history with "Carregar mais".
export async function listRunsForOwner(
  userId: string,
  limit = 50,
  cursor: string | null = null,
  assistantType: AssistantType | null = null,
): Promise<{ runs: AssistantRunSummary[]; nextCursor: string | null }> {
  const sb = getServerSupabase();
  const cappedLimit = Math.min(Math.max(limit, 1), 200);
  let q = sb
    .from('assistant_runs')
    .select(
      'id, assistant_type, template_id, params, status, error_message, created_at, finished_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    // Fetch one extra row to know if there's a next page without a count.
    .limit(cappedLimit + 1);
  if (cursor) {
    q = q.lt('created_at', cursor);
  }
  if (assistantType) {
    q = q.eq('assistant_type', assistantType);
  }
  const { data, error } = await q;
  if (error) {
    console.warn('[assistants/runs] listRunsForOwner failed:', error.message);
    return { runs: [], nextCursor: null };
  }
  const rows = (data ?? []) as AssistantRunSummary[];
  const hasMore = rows.length > cappedLimit;
  const trimmed = hasMore ? rows.slice(0, cappedLimit) : rows;
  const nextCursor = hasMore
    ? (trimmed[trimmed.length - 1]?.created_at ?? null)
    : null;
  return { runs: trimmed, nextCursor };
}

// ── Sub-projeto 22 — Negotiation helpers ─────────────────────────────────

// Grava o resultado do Strategy Builder. `strategy` é JSONB; status fica
// 'done' (a estratégia é o artefato principal — o simulator é opcional).
// `output_md` é também populado pra suporte ao download do .docx
// "Visualizar Estratégia Completa" (renderiza o JSON em markdown legível).
export async function updateRunStrategy(
  id: string,
  strategy: NegotiationStrategyResult,
  outputMd: string,
): Promise<boolean> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from('assistant_runs')
    .update({
      strategy,
      output_md: outputMd,
      status: 'done',
      finished_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.warn('[assistants/runs] updateRunStrategy failed:', error.message);
    return false;
  }
  return true;
}

// Atualiza transcript inteiro (cliente envia histórico completo a cada
// turno, então persistimos snapshot completo — simples e correto).
export async function updateRunTranscript(
  id: string,
  transcript: NegotiationTranscriptTurn[],
): Promise<boolean> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from('assistant_runs')
    .update({ transcript })
    .eq('id', id);
  if (error) {
    console.warn(
      '[assistants/runs] updateRunTranscript failed:',
      error.message,
    );
    return false;
  }
  return true;
}

// Grava score ao encerrar a simulação. Não muda status (já é 'done' da
// strategy); só adiciona o score JSONB. Se quiser reabrir e continuar
// negociando, o score é simplesmente sobrescrito da próxima vez.
export async function updateRunScore(
  id: string,
  score: NegotiationScore,
): Promise<boolean> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from('assistant_runs')
    .update({ score })
    .eq('id', id);
  if (error) {
    console.warn('[assistants/runs] updateRunScore failed:', error.message);
    return false;
  }
  return true;
}

// Item 6 do roadmap — persiste o histórico do refine-chat. O cliente envia o
// histórico completo a cada turno, então gravamos o snapshot inteiro (simples
// e correto, igual ao transcript da negociação). Fire-and-forget no onFinish:
// falha de persistência não pode quebrar o streaming do refine.
export async function updateRunRefineMessages(
  id: string,
  messages: RefineMessage[],
): Promise<boolean> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from('assistant_runs')
    .update({ refine_messages: messages })
    .eq('id', id);
  if (error) {
    console.warn('[assistants/runs] updateRunRefineMessages failed:', error.message);
    return false;
  }
  return true;
}

// Owner-scoped lookup. Used by the docx download endpoint to verify the
// caller owns the run before rendering. We pass userId explicitly rather
// than relying on RLS so the route's auth check is visible in code review.
export async function getRunForOwner(
  id: string,
  userId: string,
): Promise<AssistantRunRow | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('assistant_runs')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[assistants/runs] getRunForOwner failed:', error.message);
    return null;
  }
  return (data as AssistantRunRow | null) ?? null;
}
