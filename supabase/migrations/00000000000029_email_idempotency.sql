-- Sub-projeto 30 — Email transacional.
--
-- profiles.welcome_email_sent_at evita double-send do email de boas-vindas
-- quando user passa por /auth/callback múltiplas vezes (PKCE retry,
-- token refresh, etc.). Welcome dispara apenas se NULL → marca timestamp
-- antes de enviar.
--
-- Recibos e overdue usam Resend `idempotency_key = asaas_event_id`
-- (sub-projeto 27 já garante unique por evento), então não precisam de
-- coluna nova.
--
-- Idempotente: pode ser re-rodada.

alter table profiles
  add column if not exists welcome_email_sent_at timestamptz;
