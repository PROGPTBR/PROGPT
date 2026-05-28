-- Sub-projeto 28 — Aceite de Termos de Uso + Privacidade no signup.
--
-- LGPD + CDC: pra defender em contestação no PROCON ou juízo, precisamos
-- provar que o user aceitou termos vigentes na data X. Versionamos os
-- termos pra que updates futuros possam exigir re-aceite (banner ou
-- gate no login).
--
-- Idempotente: pode ser re-rodada.

alter table profiles
  add column if not exists terms_accepted_at timestamptz;

alter table profiles
  add column if not exists terms_version text;

-- Backfill: users que criaram conta antes desta migration aceitaram
-- implicitamente quando havia (até então não havia termos publicados).
-- Marcamos como v0-pre-launch pra distinguir de aceites explícitos.
update profiles
   set terms_accepted_at = coalesce(terms_accepted_at, created_at),
       terms_version = coalesce(terms_version, 'v0-pre-launch')
 where terms_accepted_at is null;
