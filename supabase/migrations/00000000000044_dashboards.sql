-- Dashboards personalizados salvos por usuário (construtor de dashboard).
-- O usuário sobe uma planilha (ou usa um template), monta a tela com peças
-- (gráficos, KPIs, KPIs manuais) e salva. Mesmo padrão de `sessions`: CRUD
-- direto pelo browser client com RLS owner-only.
--
-- `columns` e `rows` guardam o dataset (rows capado no client) pra reabrir o
-- dashboard sem re-upload; `panels` é o layout de peças (PanelConfig[]).

create table if not exists dashboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Meu dashboard',
  source_name text,
  columns jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  panels jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboards_user_updated_idx
  on dashboards (user_id, updated_at desc);

alter table dashboards enable row level security;

create policy dashboards_select_own on dashboards
  for select using (user_id = auth.uid());
create policy dashboards_insert_own on dashboards
  for insert with check (user_id = auth.uid());
create policy dashboards_update_own on dashboards
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dashboards_delete_own on dashboards
  for delete using (user_id = auth.uid());
