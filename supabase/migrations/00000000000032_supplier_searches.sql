-- Roadmap item 5 — Saved supplier searches ("Buscas recentes").
--
-- Lets a user save a supplier search (CNAE + UFs + a label) and re-run it with
-- one click. The supplier DATA lives in an external Railway DB; only the search
-- PARAMETERS are saved here (user-owned, main Supabase, RLS owner-only).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS.

create table if not exists supplier_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,
  cnae varchar(7) not null,
  cnae_name text,
  ufs text[] default '{}',
  created_at timestamptz not null default now()
);

-- List a user's searches newest-first.
create index if not exists supplier_searches_user_created_idx
  on supplier_searches (user_id, created_at desc);

alter table supplier_searches enable row level security;

drop policy if exists supplier_searches_select_own on supplier_searches;
create policy supplier_searches_select_own on supplier_searches
  for select using (user_id = auth.uid());

drop policy if exists supplier_searches_insert_own on supplier_searches;
create policy supplier_searches_insert_own on supplier_searches
  for insert with check (user_id = auth.uid());

drop policy if exists supplier_searches_delete_own on supplier_searches;
create policy supplier_searches_delete_own on supplier_searches
  for delete using (user_id = auth.uid());
