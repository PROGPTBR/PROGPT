-- MIGRATION RETROATIVA / DOCUMENTACIONAL.
--
-- Este schema JÁ EXISTE em produção — foi aplicado direto no banco (fora do
-- fluxo de `supabase/migrations/`) em algum momento entre os sub-projetos 27
-- (billing Asaas) e 42 (signup com cartão). Esta migration não muda nada em
-- produção (tudo `IF NOT EXISTS`); ela existe pra trazer ambientes novos/dev
-- pra paridade com produção e documentar o estado real do schema.
--
-- Confirmado via introspecção real do banco (information_schema + pg_catalog,
-- pooler us-west-2) em 2026-08-31. Ver CLAUDE.md "O que evitar" sobre schema
-- drift antes de mexer estruturalmente em `profiles`/billing de novo.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Colunas de `profiles` usadas por lib/auth.ts (Profile type) e pelo fluxo
-- de signup/billing (app/api/signup, lib/billing/*) mas nunca versionadas.
alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists cpf_cnpj text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists professional_requirement text;
alter table profiles add column if not exists plan text default 'free';
alter table profiles add column if not exists selected_plan text;
alter table profiles add column if not exists asaas_customer_id text;
alter table profiles add column if not exists asaas_subscription_id text;
alter table profiles add column if not exists subscription_status text;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Tabela `plans` — catálogo de planos exibido publicamente (ex: /pricing
-- ou telas equivalentes), paralelo à `billing_settings` (singleton de preço
-- Pro usado pelo `/api/signup` real). As duas coexistem hoje; qual delas
-- efetivamente dirige qual tela não foi auditado nesta migration — só o
-- schema está sendo reconciliado aqui.
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price numeric not null,
  currency text default 'BRL',
  interval text default 'MONTHLY',
  features jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now(),
  sort_order integer default 0
);

alter table plans enable row level security;

drop policy if exists "Public read plans" on plans;
create policy "Public read plans" on plans
  for select using (is_active = true);

-- Mutação (insert/update/delete) fica só pra service-role, mesmo padrão de
-- `templates`/`billing_settings` — sem policy de admin aqui porque a
-- introspecção real não encontrou nenhuma; se `/admin` ganhar CRUD de planos,
-- adicionar policy dedicada nessa hora (não inventar aqui).

-- ─────────────────────────────────────────────────────────────────────────
-- 3) profiles.role já aceita 'gestor' desde a migration 0043 — sem mudança
-- aqui, só documentando que o CHECK real confirmado é:
-- check (role = any (array['user','admin','gestor']))
