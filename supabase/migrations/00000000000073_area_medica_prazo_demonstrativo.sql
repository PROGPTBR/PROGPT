-- Área Médica (sub-projeto 113): cada hospital fecha o mês no seu ritmo. O
-- demonstrativo das cirurgias de um mês chega até o dia D do N-ésimo mês
-- seguinte (padrão: dia 10 do segundo mês). Passou disso, é pendência.

alter table medico_hospitais
  add column if not exists demonstrativo_meses int not null default 2 check (demonstrativo_meses between 1 and 6),
  add column if not exists demonstrativo_dia int not null default 10 check (demonstrativo_dia between 1 and 28);
