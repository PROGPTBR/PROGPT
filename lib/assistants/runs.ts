import { getServerSupabase } from '@/lib/db/supabase';
import type { AssistantRunRow, AssistantType, RfpParams } from './types';

// Service-role CRUD for assistant_runs. The API route owns the lifecycle:
// createRun() at request start, updateRunOutput() in onFinish on success,
// failRun() in catch. RLS policies are defense-in-depth — they let the
// docx download route safely fall through to ownership check.

export async function createRun(input: {
  userId: string;
  assistantType: AssistantType;
  templateId: string | null;
  params: RfpParams;
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
