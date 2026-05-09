import { supabaseServer } from '@/lib/db/supabase-server';
import { scoreTrace } from '@/lib/observability/langfuse';
import { getServerSupabase } from '@/lib/db/supabase';

export type FeedbackInput = {
  userId: string;
  sessionId: string;
  traceId: string;
  rating: 'up' | 'down';
  comment?: string;
};

export type FeedbackResult =
  | { ok: true }
  | { ok: false; status: 404 | 500 };

export async function recordFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const sb = supabaseServer();

  // Defense-in-depth on top of RLS: confirm the session belongs to this user
  // before writing a feedback row that references it. RLS would also block the
  // upsert via the foreign key chain, but a clean 404 beats an opaque 500.
  const { data: session } = await sb
    .from('sessions')
    .select('id')
    .eq('id', input.sessionId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (!session) {
    return { ok: false, status: 404 };
  }

  const { error } = await sb
    .from('message_feedback')
    .upsert(
      {
        user_id: input.userId,
        session_id: input.sessionId,
        trace_id: input.traceId,
        rating: input.rating,
        comment: input.comment ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,trace_id' },
    );
  if (error) {
    console.error('[feedback] upsert failed:', error.message);
    return { ok: false, status: 500 };
  }

  // Mirror to Langfuse fire-and-forget; failures are logged, not propagated.
  void scoreTrace({
    traceId: input.traceId,
    name: 'user-feedback',
    value: input.rating === 'up' ? 1 : -1,
    comment: input.comment,
  }).catch((err) => {
    console.warn('[feedback] scoreTrace failed:', err);
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin helpers — use service-role client to bypass owner-only RLS
// ---------------------------------------------------------------------------

export type FeedbackRow = {
  id: string;
  trace_id: string;
  session_id: string;
  user_id: string;
  rating: 'up' | 'down';
  comment: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type ListFilters = {
  rating?: 'up' | 'down';
  resolved?: boolean;
  from?: string;
  to?: string;
  hasComment?: boolean;
  limit: number;
  offset: number;
};

export async function listFeedback(filters: ListFilters): Promise<{ rows: FeedbackRow[] }> {
  const sb = getServerSupabase();
  let q = sb
    .from('message_feedback')
    .select('id, trace_id, session_id, user_id, rating, comment, created_at, updated_at, resolved_at')
    .order('created_at', { ascending: false });
  if (filters.rating) q = q.eq('rating', filters.rating);
  if (filters.resolved === false) q = q.is('resolved_at', null);
  if (filters.resolved === true) q = q.not('resolved_at', 'is', null);
  if (filters.from) q = q.gte('created_at', filters.from);
  if (filters.to) q = q.lte('created_at', filters.to);
  if (filters.hasComment === true) q = q.not('comment', 'is', null);
  q = q.range(filters.offset, filters.offset + filters.limit - 1);
  const { data, error } = await q;
  if (error) {
    console.warn('[feedback/admin] listFeedback failed:', error.message);
    return { rows: [] };
  }
  return { rows: (data ?? []) as FeedbackRow[] };
}

export async function resolveFeedback(
  id: string,
  resolved: boolean,
): Promise<{ ok: boolean; resolved_at: string | null }> {
  const sb = getServerSupabase();
  const resolved_at = resolved ? new Date().toISOString() : null;
  const { error } = await sb
    .from('message_feedback')
    .update({ resolved_at })
    .eq('id', id);
  if (error) {
    console.warn('[feedback/admin] resolveFeedback failed:', error.message);
    return { ok: false, resolved_at: null };
  }
  return { ok: true, resolved_at };
}

export type TopQuery = { content: string; count: number };

export async function topQueries(days = 30, limit = 10): Promise<TopQuery[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb.rpc('admin_top_queries', { p_days: days, p_limit: limit });
  if (error) {
    console.warn('[feedback/admin] topQueries failed:', error.message);
    return [];
  }
  return ((data ?? []) as Array<{ content: string; count: number | bigint }>).map((r) => ({
    content: r.content,
    count: Number(r.count),
  }));
}
