-- Sub-projeto 31 — Assistente de Análise ABC (Curva de Pareto sobre spend)
-- Extends templates.assistant_type CHECK to allow 'abc' so admins can
-- curate ABC templates alongside rfp / kraljic / porter / financial.
--
-- assistant_runs.assistant_type is text-without-CHECK on purpose (see
-- migration 0014) — no constraint change needed there.

alter table templates
  drop constraint if exists templates_assistant_type_check;
alter table templates
  add constraint templates_assistant_type_check
  check (assistant_type in ('rfp', 'kraljic', 'porter', 'financial', 'abc'));
