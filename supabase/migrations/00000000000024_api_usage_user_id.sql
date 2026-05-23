-- Sub-projeto 23 — Custos por usuário no /admin/costs.
--
-- api_usage_events não tinha user_id (criada no sub-projeto 19 sem
-- multi-tenancy em mente). Adicionar coluna nullable + index +
-- nova RPC pra agregação por usuário, com JOIN em profiles_with_email
-- pra mostrar email no dashboard.

alter table api_usage_events
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists api_usage_events_user_id_idx
  on api_usage_events (user_id, created_at desc)
  where user_id is not null;

-- Agregação por usuário no período. Retorna 1 row por usuário + 1 row
-- "anonymous" (user_id is null — pre-feature ou call sites sem contexto
-- ainda). LEFT JOIN com profiles_with_email pra trazer email; users
-- deletados aparecem com email null.
create or replace function admin_api_usage_by_user(p_days int default 30)
returns table (
  user_id uuid,
  user_email text,
  call_count bigint,
  tokens_in bigint,
  tokens_out bigint,
  tokens_cached bigint,
  cost_usd_cents numeric,
  by_operation jsonb
) language sql stable as $$
  with agg as (
    select
      e.user_id,
      e.operation,
      count(*)::bigint as op_call_count,
      sum(e.tokens_in)::bigint as op_tokens_in,
      sum(e.tokens_out)::bigint as op_tokens_out,
      sum(e.tokens_cached)::bigint as op_tokens_cached,
      sum(e.cost_usd_cents)::numeric as op_cost
    from api_usage_events e
    where e.created_at >= now() - (p_days::text || ' days')::interval
    group by e.user_id, e.operation
  )
  select
    a.user_id,
    p.email as user_email,
    sum(a.op_call_count)::bigint as call_count,
    sum(a.op_tokens_in)::bigint as tokens_in,
    sum(a.op_tokens_out)::bigint as tokens_out,
    sum(a.op_tokens_cached)::bigint as tokens_cached,
    sum(a.op_cost)::numeric as cost_usd_cents,
    jsonb_agg(
      jsonb_build_object(
        'operation', a.operation,
        'callCount', a.op_call_count,
        'costUsdCents', a.op_cost
      )
      order by a.op_cost desc
    ) as by_operation
  from agg a
  left join profiles_with_email p on p.id = a.user_id
  group by a.user_id, p.email
  order by cost_usd_cents desc nulls last
$$;
