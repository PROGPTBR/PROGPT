-- Área Médica (sub-projeto 115): cirurgia marcada pela agenda espera a
-- confirmação de que aconteceu ("a operação aconteceu, a secretária abre e
-- marca, e aí disparam as sequências", Alexandre, 2026-11-25).
alter table medico_cirurgias add column if not exists confirmar boolean not null default false;
