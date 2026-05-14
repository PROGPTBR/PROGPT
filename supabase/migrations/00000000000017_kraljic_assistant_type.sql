-- Sub-projeto 27 — Assistente de Kraljic
-- Adds 'kraljic' to the templates.assistant_type CHECK so admins can curate
-- Kraljic templates the same way they curate RFP templates.
--
-- assistant_runs.assistant_type is text-without-CHECK on purpose (see
-- migration 0014) — no constraint change needed there.

alter table templates
  drop constraint if exists templates_assistant_type_check;
alter table templates
  add constraint templates_assistant_type_check
  check (assistant_type in ('rfp', 'kraljic'));
