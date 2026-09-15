-- Fundação "Plataforma" (parte 2) — plataforma_templates + provisionamento.
--
-- Nome prefixado `plataforma_` DE PROPÓSITO pra não colidir com a tabela
-- `templates` já existente (markdown de prompt por assistente — sub-projeto
-- 20 em diante). Conceitos diferentes: `templates` é conteúdo curado pelo
-- admin pra um assistente específico; `plataforma_templates` é um blueprint
-- de configuração de ORG (o que uma org nova herda ao ser provisionada).

create table if not exists plataforma_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  -- Snapshot de configuração copiado pra orgs.org_settings no momento do
  -- provisionamento (ver plataforma_provisionar_org abaixo). Forma livre —
  -- Fase 1 não define um schema rígido; exemplos esperados: assistentes
  -- habilitados, overrides de perfil de empresa padrão, tier de rate-limit.
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table plataforma_templates enable row level security;

create policy plataforma_templates_super_admin_read on plataforma_templates
  for select to authenticated using (is_super_admin());
-- Mutações só via service-role (rotas /api/plataforma/templates/*), mesmo
-- padrão da tabela `templates` — sem policy de insert/update/delete aqui.

alter table orgs
  add constraint orgs_template_id_fkey
  foreign key (template_id) references plataforma_templates(id);

alter table orgs add column if not exists org_settings jsonb not null default '{}'::jsonb;

-- plataforma_provisionar_org: copia plataforma_templates.config pra
-- orgs.org_settings e registra a proveniência em orgs.template_id.
-- Idempotente (UPDATE, não INSERT) — pode ser chamada de novo (ex.: trocar
-- o template de uma org já existente) sem duplicar nada. Fase 1 só copia o
-- JSON de config; semear linhas em outras tabelas fica pra Fase 2.
create or replace function plataforma_provisionar_org(p_org_id uuid, p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_config jsonb;
begin
  select config into v_config from plataforma_templates where id = p_template_id;
  if v_config is null then
    raise exception 'plataforma_templates % não encontrado', p_template_id;
  end if;

  update orgs
  set template_id = p_template_id,
      org_settings = v_config,
      updated_at = now()
  where id = p_org_id;
end;
$$;

revoke execute on function plataforma_provisionar_org(uuid, uuid) from public;
revoke execute on function plataforma_provisionar_org(uuid, uuid) from authenticated;
grant execute on function plataforma_provisionar_org(uuid, uuid) to service_role;
