-- Sub-projeto 36 — Trial de 3 dias + config de billing administrável.
--
-- Aditiva e idempotente (pode re-rodar). NÃO quebra nada existente.
--
-- (1) subscriptions ganha `trial_end` e o status 'trialing'.
-- (2) billing_settings: 1 linha singleton com a config do Asaas que o admin
--     gerencia pelo painel (/admin/billing). RLS sem policies — só
--     service-role (server) lê/escreve. A chave do Asaas NUNCA vai pro client.

-- (1) trial_end + status 'trialing' -------------------------------------
alter table subscriptions
  add column if not exists trial_end timestamptz;

alter table subscriptions
  drop constraint if exists subscriptions_status_check;

alter table subscriptions
  add constraint subscriptions_status_check
  check (status in ('pending','trialing','active','past_due','cancelled','expired'));

-- index pra varrer trials a expirar
create index if not exists subscriptions_trial_idx
  on subscriptions(trial_end)
  where status = 'trialing';

-- (2) billing_settings (singleton) --------------------------------------
create table if not exists billing_settings (
  id int primary key default 1,
  asaas_api_key text,
  asaas_api_url text not null default 'https://sandbox.asaas.com/api/v3',
  plan_price numeric(10,2) not null default 127.99,
  trial_days int not null default 3,
  updated_at timestamptz not null default now(),
  constraint billing_settings_singleton check (id = 1)
);

-- semeia a linha singleton (sem chave — admin preenche pelo painel; fallback
-- continua sendo o env ASAAS_API_KEY)
insert into billing_settings (id) values (1)
  on conflict (id) do nothing;

alter table billing_settings enable row level security;
-- sem policies: só service-role acessa (mesmo padrão de billing_webhook_events)
