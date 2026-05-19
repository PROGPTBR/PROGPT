-- Sub-projeto 29 — Assistente das 5 Forças de Porter
-- Extends templates.assistant_type CHECK to allow 'porter' so admins can
-- curate Porter templates alongside the existing rfp / kraljic ones.
--
-- assistant_runs.assistant_type is text-without-CHECK on purpose (see
-- migration 0014) — no constraint change needed there.

alter table templates
  drop constraint if exists templates_assistant_type_check;
alter table templates
  add constraint templates_assistant_type_check
  check (assistant_type in ('rfp', 'kraljic', 'porter'));
