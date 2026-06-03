-- Sub-projeto 32 — Biblioteca de Prompts.
--
-- Importa a biblioteca curada de prompts de procurement do app-fonte
-- (pro-ai-circle) para dentro do PROGPT. `prompts` é admin-curada e legível
-- por qualquer usuário autenticado (mesmo modelo de RLS de `articles` —
-- SELECT para authenticated, mutações só via service-role). `prompt_favorites`
-- é owner-only (espelha message_feedback/sessions).
--
-- NÃO entra no retrieval RAG: é biblioteca administrativa, separada de
-- articles/chunks. Idempotente (create ... if not exists, drop policy if exists).

create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_number int,                          -- referência estável do app-fonte (nullable)
  title text not null,
  summary text not null default '',
  content text not null,
  category text not null default 'Geral',     -- nome denormalizado (padrão de articles.theme)
  tags text[] not null default '{}',
  is_published boolean not null default true, -- admin pode ocultar sem deletar
  source text default 'pro-ai-circle',        -- proveniência/auditoria
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prompts_category_idx on prompts (category);
create index if not exists prompts_tags_gin on prompts using gin (tags);
-- prompt_number só é único quando presente (importados); criados via admin ficam null
create unique index if not exists prompts_prompt_number_key
  on prompts (prompt_number) where prompt_number is not null;

alter table prompts enable row level security;
drop policy if exists prompts_authenticated_read on prompts;
-- Usuário vê só publicados; admin vê tudo (drafts/ocultos). is_admin() é
-- SECURITY DEFINER (migration 0003/0026). Mutações continuam via service-role.
create policy prompts_authenticated_read on prompts
  for select to authenticated using (is_published = true or is_admin());

-- Favoritos por usuário (owner-only).
create table if not exists prompt_favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  prompt_id uuid not null references prompts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, prompt_id)
);

alter table prompt_favorites enable row level security;
drop policy if exists prompt_favorites_own_select on prompt_favorites;
drop policy if exists prompt_favorites_own_insert on prompt_favorites;
drop policy if exists prompt_favorites_own_delete on prompt_favorites;
create policy prompt_favorites_own_select on prompt_favorites
  for select using (auth.uid() = user_id);
create policy prompt_favorites_own_insert on prompt_favorites
  for insert with check (auth.uid() = user_id);
create policy prompt_favorites_own_delete on prompt_favorites
  for delete using (auth.uid() = user_id);
