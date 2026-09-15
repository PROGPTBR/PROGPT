-- Fundação "Plataforma" — Super Admin + Orgs (2026-09-14).
--
-- Sub-projeto: PROGPT vira template multi-tenant da 2B Supply. Padrão
-- copiado do projeto CRM-2Mimobi (verificado em código antes de reproduzir
-- aqui): um flag global `profiles.super_admin` acima de "orgs" (tenants),
-- widened RLS via função SECURITY DEFINER, e um trigger de guarda que só
-- deixa service-role mexer nas colunas sensíveis.
--
-- Deliberadamente ADITIVA: não muda a RLS de nenhuma das ~28 tabelas
-- owner-only já existentes (sessions, articles/chunks, assistant_runs,
-- suppliers, materials, etc.) — isso é Fase 2, documentada mas não
-- construída aqui. Todo usuário existente é migrado para 1 org default, e
-- nada no comportamento de /chat, /assistants ou /admin muda nesta
-- migration.

-- ────────────────────────────────────────────────────────────────────────
-- 1) orgs (tenants)
-- ────────────────────────────────────────────────────────────────────────
create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  -- FK pra plataforma_templates é adicionada na migration seguinte (0054),
  -- depois que a tabela existir.
  template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orgs enable row level security;

-- ────────────────────────────────────────────────────────────────────────
-- 2) profiles.org_id + profiles.super_admin
-- ────────────────────────────────────────────────────────────────────────
alter table profiles add column if not exists org_id uuid references orgs(id);
alter table profiles add column if not exists super_admin boolean not null default false;

-- Org default: todo usuário existente (e todo signup novo, até a Fase 2 ter
-- onboarding de org próprio) entra aqui.
insert into orgs (slug, name)
values ('progpt-default', 'PROGPT — Instância Padrão')
on conflict (slug) do nothing;

update profiles
set org_id = (select id from orgs where slug = 'progpt-default')
where org_id is null;

alter table profiles alter column org_id set not null;

create index if not exists profiles_org_id_idx on profiles (org_id);

-- Bootstrap: o admin atual documentado no CLAUDE.md (rgoalves@gmail.com)
-- vira o primeiro super_admin, senão /plataforma fica inacessível até
-- alguém rodar um UPDATE manual (ver nota "Bootstrap do primeiro
-- super_admin" no CLAUDE.md). Roda ANTES da trigger de guarda existir
-- (próxima seção), então não precisa do workaround de GUC.
update profiles set super_admin = true
where id = '16fab8f7-a960-48b4-903d-b590e476b51b';

-- ────────────────────────────────────────────────────────────────────────
-- 3) handle_new_user() ganha org_id — todo signup novo entra na org default.
-- ────────────────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, org_id)
  values (new.id, (select id from public.orgs where slug = 'progpt-default'));
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 4) Trigger de guarda — só service-role pode mudar super_admin/org_id.
-- Mesmo espírito do guard_coluna_plataforma() do CRM-2Mimobi: fecha o
-- mesmo tipo de buraco que a migration 0026 fechou pra outras colunas
-- sensíveis (nenhuma policy de UPDATE de profiles filtra por coluna).
-- ────────────────────────────────────────────────────────────────────────
create or replace function guard_plataforma_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.super_admin is distinct from old.super_admin
      or new.org_id is distinct from old.org_id)
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'super_admin e org_id só podem ser alterados por service_role';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_plataforma_columns_trigger on profiles;
create trigger guard_plataforma_columns_trigger
  before update on profiles
  for each row execute function guard_plataforma_columns();

-- ────────────────────────────────────────────────────────────────────────
-- 5) is_super_admin() / is_org_member() — SECURITY DEFINER, mesmo padrão de
-- is_admin() (migration 0003) pra evitar recursão de RLS em profiles.
-- is_org_member() é reservada pra Fase 2 (RLS org-scoped nas tabelas de
-- domínio) — não é usada por nenhuma policy nesta migration.
-- ────────────────────────────────────────────────────────────────────────
create or replace function is_super_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce((select super_admin from profiles where id = auth.uid()), false);
$$;

create or replace function is_org_member(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce((select org_id = check_org_id from profiles where id = auth.uid()), false);
$$;

revoke execute on function is_super_admin() from public;
grant execute on function is_super_admin() to authenticated, service_role;

revoke execute on function is_org_member(uuid) from public;
grant execute on function is_org_member(uuid) to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────
-- 6) profiles RLS: super admin enxerga todos os perfis, de qualquer org.
-- ────────────────────────────────────────────────────────────────────────
create policy profiles_super_admin_read on profiles for select to authenticated
  using (is_super_admin());

-- orgs: só super admin lê (cross-tenant); mutações via service-role (rotas
-- /api/plataforma/*), mesmo padrão de plataforma_templates (migration 0054).
create policy orgs_super_admin_read on orgs for select to authenticated
  using (is_super_admin());

-- ────────────────────────────────────────────────────────────────────────
-- 7) profiles_with_email ganha org_id + super_admin (só no FINAL da lista
-- de colunas — CREATE OR REPLACE VIEW não aceita reordenar as existentes,
-- ver nota da migration 0051). /plataforma/usuarios precisa disso pra
-- listar cross-org sem duas queries.
-- ────────────────────────────────────────────────────────────────────────
create or replace view profiles_with_email as
  select p.id, p.role, p.display_name, p.created_at,
         u.email, u.last_sign_in_at, u.created_at as auth_created_at,
         u.banned_until,
         p.org_id, p.super_admin
    from profiles p
    join auth.users u on u.id = p.id;

grant select on profiles_with_email to service_role;
revoke select on profiles_with_email from authenticated, anon;
