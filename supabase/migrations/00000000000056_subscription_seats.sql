-- 0056 — Assinatura por usuário (seats), 2026-09-17.
--
-- Demanda real: uma empresa quer contratar 3 acessos para o mesmo plano.
-- Como o plano é vendido por usuário (R$ 73/usuário/mês hoje), o valor
-- cobrado passa a ser preço_unitário × seats. `seats` guarda a quantidade
-- contratada; o preço unitário continua vivendo em billing_settings/plans.
--
-- `seat_emails` é uma conveniência operacional: os e-mails dos usuários
-- ADICIONAIS informados (opcionalmente) na contratação, pra 2B Supply saber
-- pra quem provisionar os acessos. Nunca é obrigatório — o cadastro não pode
-- travar por causa dele.

alter table subscriptions
  add column if not exists seats integer not null default 1;

alter table subscriptions
  add column if not exists seat_emails jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_seats_range'
  ) then
    alter table subscriptions
      add constraint subscriptions_seats_range check (seats between 1 and 50);
  end if;
end $$;

comment on column subscriptions.seats is
  'Quantidade de usuários contratados. Valor cobrado = preço unitário × seats.';

comment on column subscriptions.seat_emails is
  'E-mails dos usuários adicionais informados na contratação (opcional, operacional).';
