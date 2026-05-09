-- Sub-projeto 14 — feedback review loop
alter table message_feedback
  add column resolved_at timestamptz;

-- Partial index — admin's default view is "show me what I haven't dealt with yet"
create index message_feedback_unresolved_idx
  on message_feedback (created_at desc)
  where resolved_at is null;

-- Top user queries from sessions.messages JSONB (admin-only via service-role)
create or replace function admin_top_queries(p_days int default 30, p_limit int default 10)
returns table (content text, count bigint)
language sql
stable
as $$
  select
    m->>'content' as content,
    count(*)::bigint as count
  from sessions s, jsonb_array_elements(s.messages) as m
  where m->>'role' = 'user'
    and s.updated_at > now() - (p_days::text || ' days')::interval
  group by m->>'content'
  order by count desc
  limit p_limit;
$$;
