-- Tour de primeiro acesso.
--
-- O marcador vive em `profiles` (e não em localStorage) para que o tour não
-- volte a aparecer quando o cliente trocar de navegador ou de computador —
-- "primeiro acesso" é da pessoa, não do dispositivo.
--
-- Mesmo padrão de profiles.welcome_email_sent_at (migration 0029).
-- Idempotente: pode ser re-rodada.

alter table profiles
  add column if not exists onboarding_tour_completed_at timestamptz;

comment on column profiles.onboarding_tour_completed_at is
  'Quando o usuário concluiu ou pulou o tour de primeiro acesso. NULL = ainda não viu.';
