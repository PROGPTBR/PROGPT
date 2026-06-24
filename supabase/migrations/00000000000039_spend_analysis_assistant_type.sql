-- Spend Analysis (Análise de Gastos) — novo assistente que transforma um lote
-- de invoices (PDF e/ou planilha) numa base classificada + KPIs + plano de
-- strategic sourcing. Processamento assíncrono (job estilo ingestão), mas
-- USER-scoped (owner-RLS), nunca admin-only.
--
-- assistant_runs.assistant_type é text-sem-CHECK de propósito (ver migrations
-- 0017-0021); só estendemos o CHECK de templates + criamos a tabela das notas.

-- 1) Permitir templates do tipo 'spend_analysis' (apenas ADICIONAR ao CHECK).
alter table templates drop constraint if exists templates_assistant_type_check;
alter table templates add constraint templates_assistant_type_check
  check (assistant_type in ('rfp','kraljic','porter','financial','abc','profile','negotiation','scorecard','homologacao','pesquisa_precos','spend_analysis'));

-- 2) Seed idempotente do template padrão (o form precisa de ≥1 template publicado).
insert into templates (assistant_type, name, description, body_md)
select
  'spend_analysis',
  'Análise de Gastos (padrão)',
  'Da nota fiscal à estratégia: base classificada por invoice, KPIs de gestão de compras e recomendações priorizadas de strategic sourcing.',
  $md$# Análise de Gastos

## 1. Sumário executivo
Veredito da carteira: concentração de fornecedores, cobertura de PO e principais oportunidades.

## 2. Indicadores (KPIs)
Gasto total na moeda de referência, nº de invoices, nº de fornecedores, ticket médio, % de invoices com PO, % de gasto com PO e tail spend.

## 3. Visão por dimensão
Gasto por categoria, por país e por fornecedor (Pareto), com a cauda longa em destaque.

## 4. Recomendações de strategic sourcing
Ações priorizadas (alta / média / baixa), cada uma com diagnóstico, alavanca, impacto esperado e drill-down das invoices que a sustentam.

## 5. Ressalvas
Notas que dependeram de revisão (baixa certeza / sem PO), conversões cambiais usadas e itens sinalizados.
$md$
where not exists (
  select 1 from templates where assistant_type = 'spend_analysis'
);

-- 3) Tabela das notas fiscais (uma linha por invoice). OWNER-RLS — cada usuário
--    só enxerga as próprias; o worker usa service-role (bypassa RLS). NÃO usar
--    is_admin() como o ingest-uploads/ingestion_jobs (trancaria todo usuário).
create table if not exists spend_invoices (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references assistant_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text,                 -- null para linhas vindas de planilha
  filename text not null,
  source text not null check (source in ('pdf','sheet')),
  status text not null default 'pending'
    check (status in ('pending','extracting','done','needs_review','error')),
  invoice_number text,
  po_number text,
  country text,
  currency text,
  total numeric,
  total_ref numeric,
  fx_rate numeric,
  payment_terms text,
  description text,
  supplier text,
  supplier_normalized text,
  invoice_date date,
  category text,
  category_justification text,
  low_confidence boolean not null default false,
  ocr_used boolean not null default false,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spend_invoices_run_idx  on spend_invoices (run_id, status);
create index if not exists spend_invoices_user_idx on spend_invoices (user_id);

alter table spend_invoices enable row level security;

drop policy if exists spend_invoices_owner_select on spend_invoices;
drop policy if exists spend_invoices_owner_insert on spend_invoices;
drop policy if exists spend_invoices_owner_update on spend_invoices;
drop policy if exists spend_invoices_owner_delete on spend_invoices;

create policy spend_invoices_owner_select on spend_invoices
  for select to authenticated using (user_id = auth.uid());
create policy spend_invoices_owner_insert on spend_invoices
  for insert to authenticated with check (user_id = auth.uid());
create policy spend_invoices_owner_update on spend_invoices
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy spend_invoices_owner_delete on spend_invoices
  for delete to authenticated using (user_id = auth.uid());
