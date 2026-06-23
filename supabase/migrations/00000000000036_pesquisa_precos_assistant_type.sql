-- Pesquisa de Preços (sub-projeto 37, fase 1) — permite templates do tipo
-- 'pesquisa_precos' + semeia o template padrão.
-- assistant_runs.assistant_type é text-sem-CHECK de propósito (ver migrations 0017-0021).
alter table templates drop constraint if exists templates_assistant_type_check;
alter table templates add constraint templates_assistant_type_check
  check (assistant_type in ('rfp','kraljic','porter','financial','abc','profile','negotiation','scorecard','homologacao','pesquisa_precos'));

-- Seed idempotente do template padrão (o form precisa de ≥1 template publicado).
insert into templates (assistant_type, name, description, body_md)
select
  'pesquisa_precos',
  'Pesquisa de Preços (padrão)',
  'Mapa de preços de referência a partir das compras públicas (CATMAT / Painel de Preços), com mediana, faixa e ressalvas metodológicas.',
  $md$# Mapa de Preços

## 1. Resumo executivo
Preço de referência por item e custo total estimado.

## 2. Mapa de preços por item
Tabela com item, CATMAT correspondente, preço de referência (mediana), faixa usual (p25–p75), nº de amostras e confiança.

## 3. Metodologia
Fonte (compras públicas / Painel de Preços), critério estatístico (mediana + IQR, descarte de outliers) e recorte regional.

## 4. Ressalvas e cuidados
Tributos e frete embutidos, unidade de fornecimento, sazonalidade e atualização monetária.

## 5. Recomendação de negociação
Como usar a faixa de preço como meta, teto e BATNA.
$md$
where not exists (
  select 1 from templates where assistant_type = 'pesquisa_precos'
);
