-- Homologação de Fornecedor (sub-projeto 36, fase 1) — permite templates do
-- tipo 'homologacao' + semeia o template padrão.
-- assistant_runs.assistant_type é text-sem-CHECK de propósito (ver migrations 0017-0021).
alter table templates drop constraint if exists templates_assistant_type_check;
alter table templates add constraint templates_assistant_type_check
  check (assistant_type in ('rfp','kraljic','porter','financial','abc','profile','negotiation','scorecard','homologacao'));

-- Seed idempotente do template padrão (o form precisa de ≥1 template publicado).
insert into templates (assistant_type, name, description, body_md)
select
  'homologacao',
  'Homologação de Fornecedor (padrão)',
  'Relatório de homologação/qualificação de fornecedor a partir de dados fiscais (situação cadastral, score de risco, compliance e certidões).',
  $md$# Relatório de Homologação de Fornecedor

## 1. Identificação do fornecedor
CNPJ, razão social e situação cadastral.

## 2. Avaliação de risco
Score (0–100), faixa de risco e fatores determinantes.

## 3. Compliance e certidões
Achados por categoria (situação cadastral, regime tributário, atividade, endereço, certidões, quadro societário) com severidade.

## 4. Recomendação de homologação
Tradução da recomendação fiscal em decisão de compras, com justificativa.

## 5. Próximos passos / due diligence complementar
Documentos e verificações a coletar antes de fechar, conforme a faixa de risco.
$md$
where not exists (
  select 1 from templates where assistant_type = 'homologacao'
);
