-- 0059 — Metas de SLA por etapa do Fluxo de Compras, 2026-09-24.
--
-- Pedido de cliente: "dashboards de atendimentos, SLA e etc". O painel de
-- gestão (sub-projeto 65) já mostra o tempo REAL de cada etapa; faltava o
-- cliente dizer qual é o prazo ACEITÁVEL — sem meta não existe SLA, existe
-- só medição.
--
-- Uma linha por (usuário, etapa). Sem CHECK na etapa: a lista vive em
-- lib/fluxo/stages.ts, como no resto do módulo.

create table if not exists fluxo_slas (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  etapa text not null,

  -- Prazo aceitável da etapa, em horas. 0 = sem meta definida.
  prazo_horas integer not null default 0 check (prazo_horas >= 0 and prazo_horas <= 8760),

  updated_at timestamptz not null default now(),

  primary key (user_id, etapa)
);

alter table fluxo_slas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='fluxo_slas' and policyname='fluxo_slas_owner') then
    create policy fluxo_slas_owner on fluxo_slas
      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

comment on table fluxo_slas is
  'Prazo aceitável (horas) por etapa do Fluxo de Compras, definido pelo próprio cliente.';
