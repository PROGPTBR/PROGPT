-- Sub-projeto 33 — Assistente de Perfil da Categoria (Strategic Sourcing Step 1)
-- Extends templates.assistant_type CHECK to allow 'profile' so admins can
-- curate Profile templates alongside the existing assistants.
--
-- assistant_runs.assistant_type is text-without-CHECK on purpose (see
-- migration 0014) — no constraint change needed there.

alter table templates
  drop constraint if exists templates_assistant_type_check;
alter table templates
  add constraint templates_assistant_type_check
  check (assistant_type in ('rfp', 'kraljic', 'porter', 'financial', 'abc', 'profile'));
