import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import {
  NegotiationStrategyResultSchema,
  type NegotiationStrategyParams,
  type NegotiationStrategyResult,
  SUPPLIER_MARKET_POSITION_LABELS,
  NEGOTIATION_OBJECTIVE_LABELS,
  KRALJIC_QUADRANT_LABELS,
  NEGOTIATION_PURCHASE_TYPE_LABELS,
  NEGOTIATION_DECISION_POWER_LABELS,
  NEGOTIATION_TECHNIQUE_LABELS,
  type NegotiationSwotInput,
} from '@/lib/assistants/types';

// Sub-projeto 22 — Strategy Builder do Assistente de Negociação.
//
// Gera JSON estruturado da estratégia: postura recomendada, poder de
// barganha bilateral, Kraljic, inteligência de mercado, sumário, SWOT,
// metas SMART. O frontend renderiza isso em cards visuais (não markdown).
//
// **Structured Outputs** via `zodResponseFormat` — força o LLM a emitir
// JSON que bate EXATAMENTE com o zod schema. Sem isso (modo json_object),
// o gpt-4o-mini retornava JSON parcial (faltando metade das chaves),
// quebrando o zod parse downstream. Structured outputs faz o LLM
// validar contra schema antes de retornar.
//
// Importante: gpt-4o-mini tem cutoff de treinamento — informações de
// mercado podem estar defasadas. O prompt instrui o LLM a marcar quando
// estiver inferindo vs fato conhecido. V1.1 vai adicionar web search.

const TIMEOUT_MS = 120_000;
const MAX_OUTPUT_TOKENS = 8_000;

const SYSTEM_PROMPT = `Você é um consultor sênior de procurement com 20 anos de experiência preparando estratégias de negociação para grandes compradores no Brasil.

Sua tarefa: dado o contexto fornecido pelo usuário (fornecedor, categoria, ZOPA, objetivos), produza uma ESTRATÉGIA DE NEGOCIAÇÃO completa preenchendo TODOS OS CAMPOS do schema (postura, bargainingPower, kraljic, marketIntel COM 5 sub-campos, executiveSummary, swot COM 4 sub-arrays, smartGoals COM 5 sub-campos).

Princípios de qualidade:
1. **Postura recomendada** deve combinar 2 dimensões em um nome curto (ex: "Colaborativa-Assertiva", "Competitiva-Firme", "Acomodativa-Estratégica"). O parágrafo (campo posture.paragraph) é texto longo em narrativa: 150-400 palavras explicando POR QUE essa postura, citando frameworks (Kraljic, MESO, BATNA, anchoring) e dados específicos do caso (não genérico). Use aspas duplas envolvendo trechos diretos quando útil.
2. **Poder de barganha** (campos bargainingPower.buyer e bargainingPower.supplier, valores 'low'|'med'|'high') é uma análise honesta — não infle artificialmente pelo lado do comprador. Use o quadrante Kraljic + share do fornecedor + alternativas no mercado pra calibrar.
3. **Kraljic** (campo kraljic): emita kraljic.quadrant (estrategico|alavancavel|gargalo|nao-critico), kraljic.label (label completo legível), e kraljic.explanation (150-300 palavras justificando o quadrante com 2-3 razões CONCRETAS do caso — não definição genérica).
4. **Inteligência de mercado** (campo marketIntel — OBRIGATÓRIO ter os 5 sub-campos): marketIntel.news, marketIntel.financials, marketIntel.innovations, marketIntel.risks, marketIntel.sustainability. Cada um: 1-3 parágrafos curtos (80-300 palavras). NÃO INVENTE dados financeiros, notícias específicas ou inovações que você não conheça com confiança alta. Quando inferindo, marque com "Provavelmente..." ou "É comum no setor que...". Quando souber por treinamento, afirme.
5. **Sumário executivo** (campo executiveSummary): 2-3 parágrafos densos (200-500 palavras). Conta a história: situação atual → alavancas que vamos usar → resultado esperado em números.
6. **SWOT** (campo swot — OBRIGATÓRIO 4 sub-arrays): swot.strengths, swot.weaknesses, swot.opportunities, swot.threats. Cada array com 3-6 bullets CURTOS (5-15 palavras cada). Forças/Fraquezas são do COMPRADOR (não do fornecedor). Oportunidades/Ameaças são externas (mercado, regulação, concorrência).
7. **SMART** (campo smartGoals — OBRIGATÓRIO 5 sub-campos): smartGoals.specific, smartGoals.measurable, smartGoals.achievable, smartGoals.relevant, smartGoals.temporal — cada um com texto distinto (40-200 palavras):
   - S (Específico): O QUE renegociar exatamente. Inclua produto/serviço.
   - M (Mensurável): META NUMÉRICA. R$, %, ou prazo. Não vago.
   - A (Atingível): Justifique POR QUE é atingível com referência ao mercado.
   - R (Relevante): Por que se conecta com o objetivo estratégico do comprador.
   - T (Temporal): Prazo concreto pra fechamento.

Tom: técnico, direto, sênior. Sem chavões. Sem "vamos explorar este tema fascinante". Não use emojis no conteúdo.

Idioma: PT-BR sempre. Termos técnicos em inglês (EDP, BATNA, MESO, ZOPA) são OK quando precisos.

CRÍTICO: emita TODOS os campos do schema. Não pule nenhum. Cada array (swot.*) precisa de pelo menos 3 itens.`;

function summarizeParams(p: NegotiationStrategyParams): string {
  const parts: string[] = [];
  parts.push(`## Fornecedor\n${p.supplierName}`);
  parts.push(`## Categoria\n${p.category}`);
  if (p.supplierWebsite)
    parts.push(`## Website / Mercado de referência\n${p.supplierWebsite}`);
  if (p.annualSpend) parts.push(`## Spend anual\n${p.annualSpend}`);
  if (p.supplierShare)
    parts.push(`## Share do fornecedor\n${p.supplierShare}`);
  if (p.marketPosition)
    parts.push(
      `## Posição do fornecedor no mercado\n${SUPPLIER_MARKET_POSITION_LABELS[p.marketPosition]}`,
    );
  if (p.kraljicQuadrant)
    parts.push(
      `## Classificação Kraljic (input do usuário)\n${KRALJIC_QUADRANT_LABELS[p.kraljicQuadrant]}`,
    );
  const zopa: string[] = [];
  if (p.currentPrice) zopa.push(`- Preço atual (seu custo): ${p.currentPrice}`);
  if (p.supplierDesiredPrice)
    zopa.push(`- Preço desejado pelo fornecedor: ${p.supplierDesiredPrice}`);
  if (p.targetPrice) zopa.push(`- Preço alvo (sua meta): ${p.targetPrice}`);
  if (p.walkawayPrice)
    zopa.push(`- Preço de abandono (seu limite máximo): ${p.walkawayPrice}`);
  if (zopa.length > 0)
    parts.push(`## ZOPA & Parâmetros Financeiros\n${zopa.join('\n')}`);
  if (p.strategicObjective)
    parts.push(
      `## Objetivo estratégico principal\n${NEGOTIATION_OBJECTIVE_LABELS[p.strategicObjective]}`,
    );
  if (p.contractStatus)
    parts.push(`## Status do contrato e relacionamento\n${p.contractStatus}`);
  if (p.priceScenario)
    parts.push(`## Cenário de preços e metas\n${p.priceScenario}`);
  if (p.productType) parts.push(`## Tipo de produto/serviço\n${p.productType}`);
  if (p.purchaseType)
    parts.push(
      `## Tipo de compra\n${NEGOTIATION_PURCHASE_TYPE_LABELS[p.purchaseType]}`,
    );
  const trocas: string[] = [];
  if (p.mustHaves) trocas.push(`- Necessário (precisa ter): ${p.mustHaves}`);
  if (p.niceToHaves)
    trocas.push(`- Desejável (seria bom ter): ${p.niceToHaves}`);
  if (p.concessions)
    trocas.push(
      `- Concessões possíveis (baixo custo p/ mim, valor p/ o vendedor): ${p.concessions}`,
    );
  if (trocas.length > 0)
    parts.push(`## Concessões e trocas\n${trocas.join('\n')}`);
  if (p.decisionPower)
    parts.push(
      `## Poder de decisão da contraparte\n${NEGOTIATION_DECISION_POWER_LABELS[p.decisionPower]}`,
    );
  if (p.negotiationTechnique)
    parts.push(
      `## Técnica de negociação preferida do comprador\n${NEGOTIATION_TECHNIQUE_LABELS[p.negotiationTechnique]}\n(Oriente a estratégia e as táticas a partir desta técnica.)`,
    );
  const swotBlock = swotInputBlock(p.swotInput);
  if (swotBlock) parts.push(swotBlock);
  return parts.join('\n\n');
}

/**
 * A SWOT veio preenchida pelo comprador? (backlog do diretor 2026-08-19,
 * Batch H). Vazia/ausente ⇒ a IA gera do zero, como antes.
 */
export function hasSwotInput(swot: NegotiationSwotInput | undefined): boolean {
  if (!swot) return false;
  return [swot.strengths, swot.weaknesses, swot.opportunities, swot.threats].some(
    (v) => (v ?? '').trim().length > 0,
  );
}

const SWOT_INPUT_LABELS: [keyof NegotiationSwotInput, string][] = [
  ['strengths', 'Forças (do comprador)'],
  ['weaknesses', 'Fraquezas (do comprador)'],
  ['opportunities', 'Oportunidades (externas)'],
  ['threats', 'Ameaças (externas)'],
];

/**
 * Bloco da SWOT do comprador. A instrução é deliberadamente forte porque o
 * comportamento anterior era inventar os 4 quadrantes do zero — o que
 * descartava o diagnóstico de quem conhece a relação com o fornecedor.
 */
export function swotInputBlock(
  swot: NegotiationSwotInput | undefined,
): string | null {
  if (!hasSwotInput(swot)) return null;
  const lines: string[] = [];
  for (const [key, label] of SWOT_INPUT_LABELS) {
    const value = (swot![key] ?? '').trim();
    if (value) lines.push(`- **${label}**: ${value}`);
  }
  return `## Matriz SWOT preenchida pelo comprador
${lines.join('\n')}

PARTA DESTE SWOT ao emitir o campo swot: preserve TODOS os pontos que o comprador trouxe (pode reescrever para ficarem curtos e objetivos, no formato de 5-15 palavras), complete os quadrantes que ficaram vazios ou rasos, e só então acrescente o que sua análise identificar. NÃO descarte nenhum ponto informado — quem preencheu conhece a relação com este fornecedor.`;
}

export async function generateStrategy(
  params: NegotiationStrategyParams,
): Promise<NegotiationStrategyResult> {
  const ai = getOpenAI();
  const model = getOpenAIModel('generation');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const summary = summarizeParams(params);
    const completion = await ai.chat.completions.parse(
      {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Contexto da negociação:\n\n${summary}\n\nProduza a estratégia preenchendo TODOS os campos do schema.`,
          },
        ],
        response_format: zodResponseFormat(
          NegotiationStrategyResultSchema,
          'negotiation_strategy',
        ),
        max_completion_tokens: MAX_OUTPUT_TOKENS,
      },
      { signal: controller.signal },
    );
    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      const refusal = completion.choices[0]?.message?.refusal;
      throw new Error(
        `Strategy generation returned no parsed content${refusal ? `; refusal: ${refusal}` : ''}`,
      );
    }
    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-negotiation-strategy',
      model,
      tokensIn: completion.usage?.prompt_tokens ?? 0,
      tokensOut: completion.usage?.completion_tokens ?? 0,
      tokensCached: completion.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      metadata: {
        category: params.category.slice(0, 80),
        kraljic: params.kraljicQuadrant ?? null,
      },
    });
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}
