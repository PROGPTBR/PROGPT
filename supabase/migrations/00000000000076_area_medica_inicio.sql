-- Área Médica, formulário de início (sub-projeto 117): o médico responde, no
-- primeiro acesso, o que só ele sabe (empresa, contador, hospitais, banco,
-- equipe) e anexa os documentos de partida. A equipe da 2B Supply preenche o
-- resto e usa as respostas para ligar o banco e lançar o primeiro mês.

alter table medico_config
  add column if not exists banco_nome text not null default '',
  add column if not exists secretaria_nome text not null default '',
  add column if not exists secretaria_contato text not null default '',
  -- '' = ainda não respondeu; 'respondido' | 'pulado'.
  add column if not exists inicio_status text not null default '' check (inicio_status in ('', 'respondido', 'pulado')),
  add column if not exists inicio_em timestamptz;

-- Tipos de documento de partida: modelo de planilha do hospital, cirurgias do
-- mês (planilha da secretária) e extrato bancário.
alter table medico_documentos drop constraint if exists medico_documentos_tipo_check;
alter table medico_documentos
  add constraint medico_documentos_tipo_check
  check (tipo in ('nota', 'demonstrativo', 'comprovante', 'pendencias', 'modelo_pendencias', 'cirurgias', 'extrato', 'outro'));
