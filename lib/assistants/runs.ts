import { getServerSupabase } from '@/lib/db/supabase';
import type {
  AssistantRunRow,
  AssistantType,
  RfpParams,
  KraljicParams,
  PorterParams,
  FinancialParams,
  AbcParams,
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
    | AbcParams;
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

// Owner-scoped list. Most recent first. Caps the result at `limit`.
// Used by /assistants/history.
export async function listRunsForOwner(
  userId: string,
  limit = 50,
): Promise<AssistantRunSummary[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('assistant_runs')
    .select(
      'id, assistant_type, template_id, params, status, error_message, created_at, finished_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) {
    console.warn('[assistants/runs] listRunsForOwner failed:', error.message);
    return [];
  }
  return (data ?? []) as AssistantRunSummary[];
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
