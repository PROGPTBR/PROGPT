-- Área Médica (sub-projeto 116): régua de cobrança por hospital. Dias, a partir
-- do vencimento da pendência (prazo do demonstrativo), em que a planilha de
-- pendências é enviada de novo: D0, D+7, D+15, D+30; depois da última etapa,
-- repete no último intervalo. Antes era um só "30 dias" fixo no código.
alter table medico_hospitais add column if not exists regua jsonb not null default '[0, 7, 15, 30]'::jsonb;
