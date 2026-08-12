-- Base de fornecedores do comprador ("Minha base de fornecedores").
--
-- O vendor master que faltava: a busca (/assistants/suppliers) achava empresas
-- na base externa da Receita mas nada persistia. Aqui o usuário CURA a carteira
-- de fornecedores que interessa — salvos da busca ou cadastrados à mão — com
-- ciclo de vida (status), categoria, contato e notas.
--
-- User-owned (RLS owner-only), main Supabase. Os DADOS canônicos seguem na
-- Receita; aqui é o recorte curado do usuário (pode divergir/anotar à vontade).
-- Idempotente: IF NOT EXISTS + DROP POLICY IF EXISTS.

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cnpj varchar(14),                 -- nullable: cadastro manual pode não ter
  cnpj_basico varchar(8),           -- 8 primeiros dígitos (dedup com a busca)
  razao_social text not null,
  nome_fantasia text,
  cnae varchar(7),
  cnae_name text,
  uf varchar(2),
  municipio text,
  telefone text,
  email text,
  categoria text,
  status text not null default 'prospecto'
    check (status in ('prospecto','em_homologacao','homologado','ativo','bloqueado','descartado')),
  rating int check (rating is null or (rating between 0 and 5)),
  notas text,
  origem text not null default 'manual'
    check (origem in ('busca','manual','homologacao')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Listagem newest-first por usuário.
create index if not exists suppliers_user_created_idx
  on suppliers (user_id, created_at desc);

-- Dedup: o mesmo usuário não salva a mesma empresa (CNPJ base) duas vezes.
-- Parcial porque cadastro manual pode ter cnpj_basico nulo (vários permitidos).
create unique index if not exists suppliers_user_cnpjbasico_uniq
  on suppliers (user_id, cnpj_basico) where cnpj_basico is not null;

alter table suppliers enable row level security;

drop policy if exists suppliers_select_own on suppliers;
create policy suppliers_select_own on suppliers
  for select using (user_id = auth.uid());

drop policy if exists suppliers_insert_own on suppliers;
create policy suppliers_insert_own on suppliers
  for insert with check (user_id = auth.uid());

drop policy if exists suppliers_update_own on suppliers;
create policy suppliers_update_own on suppliers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists suppliers_delete_own on suppliers;
create policy suppliers_delete_own on suppliers
  for delete using (user_id = auth.uid());
