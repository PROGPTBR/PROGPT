-- Sub-projeto 27 — Billing (Asaas hosted checkout).
--
-- subscriptions: 1:1 com auth.users (1 user = 1 subscription ativa).
-- billing_webhook_events: idempotency + audit log de eventos recebidos
-- do Asaas. Sem pg_cron — webhook é o source-of-truth da mudança de
-- estado.
--
-- Idempotente: pode ser re-rodada sem efeito colateral (CREATE IF NOT
-- EXISTS + DROP POLICY IF EXISTS).

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  asaas_customer_id text,
  asaas_subscription_id text unique,
  status text not null check (status in ('pending','active','past_due','cancelled','expired')),
  plan text not null default 'pro',
  payment_method text check (payment_method in ('credit_card','pix','boleto')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on subscriptions(user_id);
create index if not exists subscriptions_active_idx on subscriptions(status, current_period_end desc)
  where status in ('active','past_due');

-- Idempotency + audit. Asaas envia o mesmo webhook 3x em caso de falha
-- de processamento — `asaas_event_id` unique garante exactly-once.
create table if not exists billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  asaas_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists billing_webhook_events_unprocessed
  on billing_webhook_events(created_at desc)
  where processed_at is null;

-- RLS: user lê só a própria sub (pra /account/billing client-side).
-- service-role faz tudo via getServerSupabase em endpoints (mutações).
alter table subscriptions enable row level security;
drop policy if exists subscriptions_own_select on subscriptions;
create policy subscriptions_own_select on subscriptions
  for select using (user_id = auth.uid());

-- billing_webhook_events: RLS sem policies (mesmo padrão de
-- rate_limit_events). Só service-role no webhook handler acessa.
alter table billing_webhook_events enable row level security;
