-- Área Médica (sub-projeto 118): campos da planilha de sobreaviso que o
-- hospital cruza para pagar (atendimento, carteirinha, senha de autorização,
-- código TUSS) e o valor líquido da nota (depois das retenções), que é o que
-- cai na conta e o que a conciliação precisa comparar.

alter table medico_cirurgias
  add column if not exists atendimento text not null default '',
  add column if not exists carteirinha text not null default '',
  add column if not exists senha text not null default '',
  add column if not exists tuss text not null default '';

alter table medico_demonstrativos
  add column if not exists nota_liquido numeric(12, 2);
