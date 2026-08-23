-- Base de materiais do comprador ("Minha base de materiais") — Batch L do
-- backlog do diretor (21/08): "precisa carregar o banco de dados de materiais
-- do cliente e seus fornecedores e que possa ser atualizado".
--
-- Espelha exatamente o padrão de `suppliers` (migration 0045): user-owned
-- (RLS owner-only), main Supabase, upsert idempotente por chave natural
-- (aqui `codigo` = SKU do cliente, lá era `cnpj_basico`). Idempotente:
-- IF NOT EXISTS + DROP POLICY IF EXISTS.

create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  codigo text,                       -- SKU do cliente; nullable (cadastro manual pode não ter)
  descricao text not null,
  categoria text,
  unidade text,
  ncm varchar(8),
  fornecedor_padrao_cnpj varchar(14),
  preco_ultimo numeric,
  moeda text default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Listagem newest-first por usuário.
create index if not exists materials_user_created_idx
  on materials (user_id, created_at desc);

-- Dedup/upsert: o mesmo usuário não duplica o mesmo código de material.
-- Parcial porque cadastro manual pode ter codigo nulo (vários permitidos).
create unique index if not exists materials_user_codigo_uniq
  on materials (user_id, codigo) where codigo is not null;

alter table materials enable row level security;

drop policy if exists materials_select_own on materials;
create policy materials_select_own on materials
  for select using (user_id = auth.uid());

drop policy if exists materials_insert_own on materials;
create policy materials_insert_own on materials
  for insert with check (user_id = auth.uid());

drop policy if exists materials_update_own on materials;
create policy materials_update_own on materials
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists materials_delete_own on materials;
create policy materials_delete_own on materials
  for delete using (user_id = auth.uid());
