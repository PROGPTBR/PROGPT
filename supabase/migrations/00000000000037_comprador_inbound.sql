-- Robô Comprador — Resend Inbound (recebimento automático de cotações).
--
-- inbound_alias: endereço dedicado por usuário (ex.: cotacoes-<token>@inbound…)
--   pra mapear o e-mail recebido → usuário. Único.
-- inbound_email_id: id do e-mail recebido (Resend) gravado na cotação criada,
--   pra idempotência (Resend re-entrega webhooks).

alter table comprador_settings add column if not exists inbound_alias text;
create unique index if not exists comprador_settings_inbound_alias_key
  on comprador_settings(inbound_alias) where inbound_alias is not null;

alter table comprador_quotes add column if not exists inbound_email_id text;
create index if not exists comprador_quotes_inbound_email_idx
  on comprador_quotes(inbound_email_id) where inbound_email_id is not null;
