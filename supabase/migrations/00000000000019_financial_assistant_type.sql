-- Sub-projeto 30 — Assistente de Análise Financeira de Fornecedor
-- Extends templates.assistant_type CHECK to allow 'financial' so admins
-- can curate financial analysis templates alongside rfp / kraljic /
-- porter.
--
-- assistant_runs.assistant_type is text-without-CHECK on purpose (see
-- migration 0014) — no constraint change needed there.

alter table templates
  drop constraint if exists templates_assistant_type_check;
alter table templates
  add constraint templates_assistant_type_check
  check (assistant_type in ('rfp', 'kraljic', 'porter', 'financial'));
