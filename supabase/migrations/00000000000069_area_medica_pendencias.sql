-- Área Médica, planilha de pendências (sub-projeto 103). O hospital só aceita
-- a cobrança no modelo dele ("Levantamento de pendências" da Gestão de
-- Honorários Médicos) e não responde: o sistema guarda cada cobrança feita
-- para reconferir e reenviar o que continua sem pagamento.

alter table medico_config
  add column if not exists empresa_nome text not null default '',
  add column if not exists empresa_cnpj text not null default '',
  add column if not exists crm text not null default '',
  add column if not exists especialidade text not null default '',
  add column if not exists contato text not null default '';

alter table medico_cirurgias
  add column if not exists funcao text not null default '',
  add column if not exists registro text not null default '',
  -- Datas (AAAA-MM-DD) em que a cirurgia entrou numa planilha de pendências enviada.
  add column if not exists cobrancas jsonb not null default '[]'::jsonb;
