-- Simulações do Simulador Tributário (SN x Reforma).
--
-- O simulador (bundle React auto-contido, /simulador-sn-reforma.html) salva as
-- simulações em localStorage do navegador. Esta tabela é o espelho no servidor:
-- um script-ponte (public/simulador-bridge.js) hidrata o localStorage a partir
-- daqui ao abrir e replica cada save de volta, dando persistência real por
-- usuário, entre dispositivos, e consultável por nós.
--
-- Modelo: 1 linha por CLIENTE (empresa) do usuário; o histórico de versões vive
-- no jsonb `versoes` (mesma forma que o bundle guarda em localStorage:
--   [{ id, versao, dados, criadoEm }]).
--
-- User-owned (RLS owner-only), main Supabase. Idempotente.

create table if not exists simulador_simulacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id text not null,          -- uuid gerado pelo bundle (localStorage id)
  nome text not null,
  cnpj varchar(14),                  -- só dígitos; nullable (cadastro sem CNPJ)
  versoes jsonb not null default '[]'::jsonb,  -- [{id, versao, dados, criadoEm}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Listagem por usuário + dedup: o mesmo usuário tem 1 linha por cliente_id.
create unique index if not exists simulador_simulacoes_user_cliente_uniq
  on simulador_simulacoes (user_id, cliente_id);

create index if not exists simulador_simulacoes_user_updated_idx
  on simulador_simulacoes (user_id, updated_at desc);

alter table simulador_simulacoes enable row level security;

drop policy if exists simulador_select_own on simulador_simulacoes;
create policy simulador_select_own on simulador_simulacoes
  for select using (user_id = auth.uid());

drop policy if exists simulador_insert_own on simulador_simulacoes;
create policy simulador_insert_own on simulador_simulacoes
  for insert with check (user_id = auth.uid());

drop policy if exists simulador_update_own on simulador_simulacoes;
create policy simulador_update_own on simulador_simulacoes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists simulador_delete_own on simulador_simulacoes;
create policy simulador_delete_own on simulador_simulacoes
  for delete using (user_id = auth.uid());
