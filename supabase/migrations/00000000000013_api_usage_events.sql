-- Sub-projeto 19 — API cost tracking
-- Records each external LLM/embedding/rerank call with token counts and
-- estimated USD cost so /admin/costs can summarize spend without depending
-- on the Langfuse API (which has retention limits and rate caps).

create table if not exists api_usage_events (
  id uuid primary key default gen_random_uuid(),

  -- Which provider made the call. Adding a new provider requires updating
  -- this CHECK plus the rate card in lib/observability/api-usage.ts.
  provider text not null check (provider in ('openai', 'voyage', 'cohere')),

  -- High-level operation label so the dashboard can break costs down by
  -- pipeline stage. Free text by design (no CHECK) — new operations should
  -- appear in the dashboard without a migration. Recommended values:
  -- 'chat-generate', 'classify', 'condense', 'followups',
  -- 'classify-content', 'multimodal-parse', 'embed', 'rerank'.
  operation text not null,

  -- Optional model identifier (gpt-4o-mini, voyage-3-large, rerank-multilingual-v3.0).
  -- Useful when we test new models alongside existing ones.
  model text,

  tokens_in int not null default 0,
  tokens_out int not null default 0,
  tokens_cached int not null default 0,

  -- For rerank: number of (query, document_set) pairs charged. For embed:
  -- number of input texts. For chat: always 1. Used by the dashboard to
  -- show per-operation throughput separately from token volume.
  call_count int not null default 1,

  -- Estimated cost in USD cents at the time of the call. numeric so we can
  -- represent fractional cents (a single classifier call is ~0.01¢).
  -- Computed in TS using the rate card constants, NOT joined from a
  -- pricing table — the rate is fixed at write time so historical reports
  -- stay accurate even if rates change later.
  cost_usd_cents numeric(12, 6) not null default 0,

  -- Free-form: error info, env, retry count, prompt hash for debugging.
  metadata jsonb default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- Hot path: dashboard groups by created_at descending. The provider/operation
-- composite supports drill-downs without re-sorting.
create index if not exists api_usage_events_created_at_idx
  on api_usage_events (created_at desc);
create index if not exists api_usage_events_provider_op_idx
  on api_usage_events (provider, operation, created_at desc);

-- Admin-only via service-role; no RLS policies for anon/authenticated readers.
-- Same pattern as rate_limit_events / message_feedback.
alter table api_usage_events enable row level security;

-- SQL helper: daily totals for the dashboard. Single aggregation pass; the
-- dashboard can then transpose by provider/operation in TS without re-querying.
create or replace function admin_api_usage_daily(p_days int default 30)
returns table (
  day date,
  provider text,
  operation text,
  call_count bigint,
  tokens_in bigint,
  tokens_out bigint,
  tokens_cached bigint,
  cost_usd_cents numeric
) language sql stable as $$
  select
    created_at::date as day,
    provider,
    operation,
    count(*)::bigint as call_count,
    sum(tokens_in)::bigint as tokens_in,
    sum(tokens_out)::bigint as tokens_out,
    sum(tokens_cached)::bigint as tokens_cached,
    sum(cost_usd_cents)::numeric as cost_usd_cents
  from api_usage_events
  where created_at >= now() - (p_days::text || ' days')::interval
  group by created_at::date, provider, operation
  order by day desc, provider, operation
$$;
