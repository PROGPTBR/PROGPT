-- Sub-projeto 22 — Assistente de Negociação (Strategic Sourcing Step 6)
--
-- Two-mode assistant inspired by Deal Sim do user:
--   1. Strategy Builder: form pré-negociação que gera JSON estruturado
--      (postura, Kraljic, SWOT, SMART, Inteligência de Mercado, sumário)
--   2. Text Simulator: chat multi-turno onde o LLM personifica o fornecedor;
--      usa a estratégia como contexto. Encerra com transcript + score.
--
-- Schema changes:
--   - templates.assistant_type CHECK: + 'negotiation'
--   - assistant_runs: + strategy jsonb, + transcript jsonb, + score jsonb
--     (output_md continua sendo o "markdown pra download" — usado pra
--     gerar .docx via mdToDocxBuffer no transcript final)

alter table templates
  drop constraint if exists templates_assistant_type_check;
alter table templates
  add constraint templates_assistant_type_check
  check (assistant_type in ('rfp', 'kraljic', 'porter', 'financial', 'abc', 'profile', 'negotiation'));

alter table assistant_runs
  add column if not exists strategy jsonb,
  add column if not exists transcript jsonb,
  add column if not exists score jsonb;

comment on column assistant_runs.strategy is
  'JSONB estruturado pela Strategy Builder do assistente negotiation. Campos: posture {{label, paragraph}}, bargainingPower {{buyer, supplier}}, kraljic {{quadrant, explanation}}, marketIntel {{news, financial, innovations, risks, sustainability}}, executiveSummary, swot {{strengths, weaknesses, opportunities, threats}}, smartGoals {{specific, measurable, achievable, relevant, temporal}}.';

comment on column assistant_runs.transcript is
  'Array<{{role, content, ts}}> conversacional do Text Simulator. Populated turno-a-turno durante a sessão.';

comment on column assistant_runs.score is
  'JSONB do score 0-100 + dimensões + bullets gerado quando user encerra a simulação. Estrutura: {{overall, dimensions: {{anchoring, concessions, batna, closing}}, strengths, weaknesses, recommendations}}.';
