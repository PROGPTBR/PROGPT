-- Níveis de acesso (Admin / Gestor / Usuário) + ajuste do preço.
-- Decisões do dono (2026-07-13): papel Gestor = "quase-admin"; acesso liberado
-- só pra admin neste momento; preço cobrado = R$ 197,99.
--
-- Nota: o dashboard de monitoramento (/admin/monitor) NÃO depende de nenhuma
-- função SQL — ele agrega em JS via service-role. Esta migration só precisa
-- ser aplicada pra habilitar o papel GESTOR (o CHECK abaixo). O preço já foi
-- corrigido na linha singleton via service-role; o default abaixo é só pra
-- manter o schema coerente.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Papel GESTOR: amplia o CHECK de profiles.role (era 'user'|'admin').
-- Descobre o nome real do constraint de role (inline vira profiles_role_check,
-- mas confirmamos via catálogo pra ser robusto) e o substitui.
do $$
declare cname text;
begin
  select conname into cname
    from pg_constraint
   where conrelid = 'profiles'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%role%in%';
  if cname is not null then
    execute 'alter table profiles drop constraint ' || quote_ident(cname);
  end if;
end $$;

alter table profiles
  add constraint profiles_role_check check (role in ('user', 'admin', 'gestor'));

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Preço: o signup passou a LER billing_settings.plan_price (antes cobrava
-- 197,99 hardcoded). A linha singleton foi semeada com o default antigo
-- (127,99). O VALOR da linha já foi corrigido pra 197,99 via service-role;
-- aqui só alinhamos o DEFAULT da coluna pra futuros inserts (não deve haver,
-- é singleton) e reforçamos a linha, preservando um valor já customizado.
alter table billing_settings alter column plan_price set default 197.99;
update billing_settings set plan_price = 197.99 where id = 1 and plan_price = 127.99;
