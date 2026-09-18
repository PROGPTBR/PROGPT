-- 0057 — Licenças de uma assinatura (sub-projeto 64), 2026-09-18.
--
-- O sub-projeto 63 fez a COBRANÇA por usuário (subscriptions.seats), mas os
-- acessos extras não existiam de verdade: as contas dos colegas eram contas
-- soltas, e o gate do middleware só olhava a assinatura DO PRÓPRIO usuário —
-- então elas caíam em /planos?expired=true até alguém liberar na mão.
--
-- Esta tabela liga cada acesso extra à assinatura que o paga. O acesso do
-- convidado passa a ser DERIVADO do titular: se a assinatura dele cai, os
-- acessos caem junto; se volta, voltam junto. Sem passo manual.

create table if not exists subscription_seats (
  id uuid primary key default gen_random_uuid(),

  subscription_id uuid not null references subscriptions(id) on delete cascade,
  -- Titular (quem paga). Denormalizado pra RLS simples e barata.
  owner_id uuid not null references auth.users(id) on delete cascade,

  -- E-mail convidado. Guardado em minúsculas (normalizado na aplicação).
  email text not null,

  -- Preenchido quando o convite é aceito e a conta existe.
  member_id uuid references auth.users(id) on delete set null,

  invite_token text unique,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um convite vivo por e-mail por assinatura (revogado libera o e-mail).
create unique index if not exists subscription_seats_sub_email_idx
  on subscription_seats (subscription_id, email)
  where revoked_at is null;

create index if not exists subscription_seats_owner_idx on subscription_seats(owner_id);
create index if not exists subscription_seats_member_idx on subscription_seats(member_id)
  where revoked_at is null;

alter table subscription_seats enable row level security;

-- Titular enxerga/gerencia os acessos que ele paga; convidado enxerga o
-- próprio. Escritas reais passam por service-role nas rotas, mas a policy
-- de select existe pra o cliente poder ler sem rota quando fizer sentido.
drop policy if exists subscription_seats_owner_select on subscription_seats;
create policy subscription_seats_owner_select on subscription_seats
  for select to authenticated
  using (owner_id = auth.uid() or member_id = auth.uid());

-- ============================================================
-- Resolução de acesso: assinatura própria OU licença aceita.
--
-- O middleware chama isto em vez de ler `subscriptions` direto. Assim a
-- lógica de "o que conta como acesso válido" (trial, atraso, cancelado com
-- período pago) continua no middleware, sem duplicação — muda só DE ONDE
-- vem a linha de assinatura.
--
-- Sem parâmetro de propósito: usa auth.uid(), então um usuário não consegue
-- consultar o acesso de outro.
-- ============================================================
create or replace function public.resolve_subscription_access()
returns table (
  status text,
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  via text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.status, s.trial_end, s.current_period_end, s.cancel_at_period_end, 'owner'::text as via
  from subscriptions s
  where s.user_id = auth.uid()

  union all

  select s.status, s.trial_end, s.current_period_end, s.cancel_at_period_end, 'seat'::text as via
  from subscription_seats seat
  join subscriptions s on s.id = seat.subscription_id
  where seat.member_id = auth.uid()
    and seat.accepted_at is not null
    and seat.revoked_at is null
    and not exists (select 1 from subscriptions o where o.user_id = auth.uid())

  limit 1
$$;

revoke execute on function public.resolve_subscription_access() from public;
grant execute on function public.resolve_subscription_access() to authenticated, service_role;

comment on table subscription_seats is
  'Licenças (acessos extras) de uma assinatura. O acesso do convidado é derivado da assinatura do titular.';
