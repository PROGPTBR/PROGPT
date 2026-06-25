-- Sub-projeto 36.2 — onboarding card-first.
--
-- O cliente informa nome/CPF/e-mail (SEM senha), cadastra o cartão no Asaas e
-- SÓ ENTÃO a conta (auth.users) é criada + e-mail pra definir senha. Entre o
-- "informou dados" e o "cartão confirmado" o estado fica aqui (não há user_id
-- ainda). A finalização (criar conta) acontece no retorno do checkout (token)
-- e/ou no webhook do Asaas — idempotente via `status`.
create table if not exists public.pending_signups (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,                  -- vai no successUrl do Asaas
  email text not null,
  full_name text not null,
  cpf text not null,
  phone text,
  professional_requirement text,
  accepted_terms boolean not null default true,
  asaas_customer_id text not null,
  asaas_subscription_id text not null,
  trial_end timestamptz not null,
  status text not null default 'awaiting_card', -- awaiting_card | completed
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists pending_signups_asaas_sub_idx
  on public.pending_signups(asaas_subscription_id);
create index if not exists pending_signups_email_idx
  on public.pending_signups(lower(email));

-- Só service-role acessa (sem policies).
alter table public.pending_signups enable row level security;

-- Helper: resolve user_id por e-mail (auth.users não é exposto via PostgREST).
-- Usado pra (a) barrar e-mail já cadastrado no start-trial e (b) reaproveitar
-- conta existente na finalização.
create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke execute on function public.user_id_by_email(text) from public, anon, authenticated;
