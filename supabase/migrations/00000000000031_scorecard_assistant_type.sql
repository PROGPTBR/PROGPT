-- Supplier Scorecard (Strategic Sourcing step 8) — permite templates do tipo 'scorecard'.
alter table templates drop constraint if exists templates_assistant_type_check;
alter table templates add constraint templates_assistant_type_check
  check (assistant_type in ('rfp','kraljic','porter','financial','abc','profile','negotiation','scorecard'));
