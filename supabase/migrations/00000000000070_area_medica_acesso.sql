-- Área Médica, tipo de conta (sub-projeto 105). O médico é um cliente à
-- parte: entra só na Área Médica (sem chat, assistentes ou o resto) e não
-- passa pela assinatura do plano de compras.
--   ''        conta comum
--   'medico'  só a Área Médica
--   'equipe'  conta comum que TAMBÉM enxerga a Área Médica (2B Supply)

alter table profiles
  add column if not exists area_medica text not null default '' check (area_medica in ('', 'medico', 'equipe'));

-- A coluna decide acesso: só o servidor muda (mesma trava de super_admin e
-- org_id). Sem isso o próprio usuário se daria acesso pelo navegador.
create or replace function guard_plataforma_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.super_admin is distinct from old.super_admin
      or new.org_id is distinct from old.org_id
      or new.area_medica is distinct from old.area_medica)
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'super_admin, org_id e area_medica só podem ser alterados por service_role';
  end if;
  return new;
end;
$$;
