-- Análise Tributária de Propostas + módulos por empresa (2026-10-20)
--
-- 1) 'tributario_propostas' no CHECK de templates.assistant_type.
--    (assistant_runs.assistant_type é text sem CHECK, ver 0014.)
-- 2) modulos_desativados(): lista de módulos desligados para a empresa (org)
--    de quem está logado. A lista vive em orgs.org_settings->'modulos_desativados'
--    (array de ids, ver lib/modulos/catalogo.ts). Lista negra de propósito:
--    org sem a chave = tudo liberado, então nenhuma empresa existente perde
--    acesso com esta migration.
--    SECURITY DEFINER e sem parâmetro (usa auth.uid()): usuário comum não lê
--    a tabela orgs (só super admin tem policy de select), e ninguém consulta
--    os módulos de outra empresa.

alter table templates
  drop constraint if exists templates_assistant_type_check;
alter table templates
  add constraint templates_assistant_type_check
  check (assistant_type in (
    'rfp', 'kraljic', 'porter', 'financial', 'abc', 'profile',
    'negotiation', 'scorecard', 'homologacao', 'pesquisa_precos',
    'spend_analysis', 'diagnostico_aquisicao', 'tributario_propostas'
  ));

create or replace function public.modulos_desativados()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select array(select jsonb_array_elements_text(o.org_settings->'modulos_desativados'))
      from profiles p
      join orgs o on o.id = p.org_id
      where p.id = auth.uid()
        and jsonb_typeof(o.org_settings->'modulos_desativados') = 'array'
    ),
    '{}'::text[]
  );
$$;

revoke all on function public.modulos_desativados() from public;
grant execute on function public.modulos_desativados() to authenticated, service_role;
