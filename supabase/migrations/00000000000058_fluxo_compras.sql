-- 0058 — Fluxo Automatizado de Compras (módulo novo), 2026-09-22.
--
-- Fonte: planilha Fluxo_Automatizado_Compras_PROGPT.xlsx (aba "Operação").
-- 8 etapas, cada uma com um gate humano: a IA executa, o comprador revisa e
-- decide SIGA (avança) ou AJUSTAR (refaz a MESMA etapa com a correção).
--
-- Difere do Proc2Pay (migration 0042): lá existe UM gate de aprovação no fim;
-- aqui o gate é por etapa — é a premissa do produto ("pessoas decidem, a IA
-- faz o resto"), não um detalhe de implementação.

create table if not exists fluxo_processos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  titulo text not null,
  -- Texto da requisição que abriu o processo (colado, de formulário ou e-mail).
  requisicao text not null default '',

  -- Etapa em que o processo está parado. Sem CHECK de propósito: a lista de
  -- etapas vive em lib/fluxo/stages.ts e um CHECK aqui exigiria migration a
  -- cada ajuste da planilha.
  etapa_atual text not null default 'solicitacao',

  status text not null default 'em_andamento'
    check (status in ('em_andamento','concluido','cancelado')),

  -- Acumulador de handoff: só entra aqui a saída de etapa que recebeu SIGA.
  contexto jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fluxo_processos_user_idx
  on fluxo_processos(user_id, updated_at desc);

create table if not exists fluxo_etapas (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references fluxo_processos(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  etapa text not null,
  -- AJUSTAR não corrige a execução: gera uma rodada NOVA da mesma etapa, pra
  -- o histórico mostrar o que a IA tinha proposto antes da correção.
  rodada integer not null default 1,

  saida jsonb not null,

  decisao text not null default 'pendente'
    check (decisao in ('pendente','siga','ajustar')),
  observacao text,
  decidida_em timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists fluxo_etapas_processo_idx
  on fluxo_etapas(processo_id, created_at);

-- Uma execução pendente por etapa/rodada.
create unique index if not exists fluxo_etapas_rodada_idx
  on fluxo_etapas(processo_id, etapa, rodada);

alter table fluxo_processos enable row level security;
alter table fluxo_etapas enable row level security;

-- Owner-only, igual às demais tabelas de domínio. Em runtime as rotas usam
-- service-role + filtro .eq('user_id') explícito — é esse filtro, não a RLS,
-- que segura o isolamento (mesma nota do Proc2Pay).
do $$
begin
  if not exists (select 1 from pg_policies where tablename='fluxo_processos' and policyname='fluxo_processos_owner') then
    create policy fluxo_processos_owner on fluxo_processos
      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where tablename='fluxo_etapas' and policyname='fluxo_etapas_owner') then
    create policy fluxo_etapas_owner on fluxo_etapas
      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

comment on table fluxo_processos is
  'Fluxo Automatizado de Compras: um processo de compra percorrendo as 8 etapas da planilha.';
comment on table fluxo_etapas is
  'Execuções de etapa. Uma linha por rodada; AJUSTAR abre rodada nova da mesma etapa.';
