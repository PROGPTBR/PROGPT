// Proc2Pay — config declarativa das etapas + helpers puros de avanço.
// Spec: docs/superpowers/specs/2026-06-29-proc2pay-design.md
//
// O orquestrador (orchestrator.ts) resolve `executor` para a função real. Tudo
// aqui é PURO e testável (sem I/O).

import type { Proc2PayContext, Stage, StageId } from './types';

export const STAGES: Stage[] = [
  {
    id: 'requisicao',
    num: 3,
    label: 'Requisição de compra',
    executor: { kind: 'form' },
    produces: 'requisicao',
    optional: false,
    mvp: true,
  },
  {
    id: 'analise_critica',
    num: 4,
    label: 'Análise crítica da requisição',
    executor: { kind: 'llm', ref: 'critique' },
    produces: 'analise_critica',
    optional: false,
    mvp: true,
  },
  {
    id: 'validacao_escopo',
    num: 5,
    label: 'Validação técnica do escopo',
    executor: { kind: 'llm', ref: 'escopo' },
    produces: 'escopo',
    optional: false,
    mvp: true,
  },
  {
    id: 'estrategia',
    num: 6,
    label: 'Estratégia de compra (Kraljic)',
    executor: { kind: 'assistant', assistant: 'kraljic' },
    produces: 'estrategia',
    optional: false,
    mvp: true,
  },
  {
    id: 'selecao_fornecedores',
    num: 7,
    label: 'Seleção de fornecedores',
    executor: { kind: 'assistant', assistant: 'suppliers' },
    produces: 'fornecedores',
    optional: false,
    mvp: true,
  },
  {
    id: 'rfq_rfp',
    num: 8,
    label: 'Envio da RFQ / RFP',
    executor: { kind: 'assistant', assistant: 'rfp' },
    produces: 'rfp',
    optional: false,
    mvp: true,
  },
  {
    id: 'recebimento_propostas',
    num: 9,
    label: 'Recebimento das propostas',
    executor: { kind: 'assistant', assistant: 'comprador-inbox' },
    produces: 'propostas',
    optional: false,
    mvp: true, // MVP: colagem/anexo manual; Caixa de Cotações automática depois
  },
  {
    id: 'equalizacao',
    num: 10,
    label: 'Equalização técnica e comercial',
    executor: { kind: 'assistant', assistant: 'comprador' },
    produces: 'equalizacao',
    optional: false,
    mvp: true,
  },
  {
    id: 'negociacao',
    num: 11,
    label: 'Negociação',
    executor: { kind: 'assistant', assistant: 'negotiation' },
    produces: 'negociacao',
    optional: false,
    mvp: true,
  },
  {
    id: 'aprovacao',
    num: 12,
    label: 'Aprovação interna',
    executor: { kind: 'approval' },
    produces: 'aprovacao',
    optional: false,
    mvp: true,
  },
  {
    id: 'emissao_po',
    num: 13,
    label: 'Emissão e envio da PO',
    executor: { kind: 'po' },
    produces: 'po',
    optional: false,
    mvp: true,
  },
  {
    id: 'follow_up',
    num: 14,
    label: 'Follow-up da entrega',
    executor: { kind: 'llm', ref: 'followup' },
    produces: 'entregas',
    optional: true, // não bloqueia o trilho; destrava após a PO
    mvp: true,
  },
  {
    id: 'avaliacao',
    num: 15,
    label: 'Avaliação do fornecedor',
    executor: { kind: 'assistant', assistant: 'scorecard' },
    produces: 'avaliacao',
    optional: true, // não bloqueia o trilho; destrava após a PO
    mvp: true,
  },
];

const STAGE_BY_ID: Record<StageId, Stage> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
) as Record<StageId, Stage>;

export function getStage(id: StageId): Stage {
  const s = STAGE_BY_ID[id];
  if (!s) throw new Error(`Proc2Pay: etapa desconhecida "${id}"`);
  return s;
}

export function stageIndex(id: StageId): number {
  return STAGES.findIndex((s) => s.id === id);
}

/** Etapas que compõem o trilho obrigatório do MVP, em ordem. */
export const MVP_TRACK: Stage[] = STAGES.filter((s) => s.mvp && !s.optional);

/**
 * Uma etapa está completa quando a chave que ela produz existe (truthy) no
 * context. Etapas sem `produces` nunca "completam" por dado (não usadas hoje).
 */
export function isStageComplete(id: StageId, context: Proc2PayContext): boolean {
  const stage = getStage(id);
  if (!stage.produces) return false;
  return context[stage.produces] != null;
}

/**
 * Próxima etapa do trilho obrigatório do MVP ainda não concluída — ou null se
 * o trilho terminou.
 */
export function nextStage(context: Proc2PayContext): Stage | null {
  return MVP_TRACK.find((s) => !isStageComplete(s.id, context)) ?? null;
}

/**
 * Uma etapa pode rodar quando todas as etapas obrigatórias ANTERIORES do trilho
 * já estão completas (gating sequencial). Etapas opcionais/fora do MVP não
 * bloqueiam e podem rodar a qualquer momento depois da requisição.
 */
export function canRunStage(id: StageId, context: Proc2PayContext): boolean {
  const stage = getStage(id);
  if (stage.optional || !stage.mvp) {
    // Cauda opcional (follow-up, avaliação): destrava quando o trilho
    // obrigatório terminou (PO emitida).
    return isTrackComplete(context);
  }
  const idx = MVP_TRACK.findIndex((s) => s.id === id);
  if (idx < 0) return false;
  return MVP_TRACK.slice(0, idx).every((s) => isStageComplete(s.id, context));
}

/** Trilho obrigatório do MVP concluído de ponta a ponta. */
export function isTrackComplete(context: Proc2PayContext): boolean {
  return nextStage(context) === null;
}
