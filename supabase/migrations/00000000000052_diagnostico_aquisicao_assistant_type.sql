-- Diagnóstico de Aquisição (2026-09-14)
-- Adds 'diagnostico_aquisicao' to the templates.assistant_type CHECK so
-- admins can curate templates for it the same way they curate the others.
--
-- assistant_runs.assistant_type is text-without-CHECK on purpose (see
-- migration 0014) — no constraint change needed there.

alter table templates
  drop constraint if exists templates_assistant_type_check;
alter table templates
  add constraint templates_assistant_type_check
  check (assistant_type in (
    'rfp', 'kraljic', 'porter', 'financial', 'abc', 'profile',
    'negotiation', 'scorecard', 'homologacao', 'pesquisa_precos',
    'spend_analysis', 'diagnostico_aquisicao'
  ));
