import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import {
  NegotiationStrategyResultSchema,
  type NegotiationStrategyParams,
  type NegotiationStrategyResult,
  SUPPLIER_MARKET_POSITION_LABELS,
  NEGOTIATION_OBJECTIVE_LABELS,
  KRALJIC_QUADRANT_LABELS,
} from '@/lib/assistants/types';

// Sub-projeto 22 — Strategy Builder do Assistente de Negociação.
//
// Gera JSON estruturado da estratégia: postura recomendada, poder de
// barganha bilateral, Kraljic, inteligência de mercado, sumário, SWOT,
// metas SMART. O frontend renderiza isso em cards visuais (não markdown).
//
// Por que JSON estrito em vez de markdown: a UI precisa renderizar
// componentes específicos (barras low/med/high, cards swot coloridos,
// blocos SMART numerados) que markdown não conseguiria sem parsing
// frágil. JSON com zod garante shape estável.
//
// Importante: gpt-4o-mini tem cutoff de treinamento — informações de
// mercado podem estar defasadas. O prompt instrui o LLM a marcar quando
// estiver inferindo vs fato conhecido. V1.1 vai adicionar web search.

const TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT = `Você é um consultor sênior de procurement com 20 anos de experiência preparando estratégias de negociação para grandes compradores no Brasil.

Sua tarefa: dado o contexto fornecido pelo usuário (fornecedor, categoria, ZOPA, objetivos), produza uma ESTRATÉGIA DE NEGOCIAÇÃO completa em JSON estrito.

Princípios de qualidade:
1. **Postura recomendada** deve combinar 2 dimensões em um nome curto (ex: "Colaborativa-Assertiva", "Competitiva-Firme", "Acomodativa-Estratégica"). O parágrafo explica POR QUE essa postura, citando frameworks (Kraljic, MESO, BATNA, anchoring) e dados específicos do caso (não genérico).
2. **Poder de barganha** (low/med/high) é uma análise honesta — não infle artificialmente pelo lado do comprador. Use o quadrante Kraljic + share do fornecedor + alternativas no mercado pra calibrar.
3. **Kraljic explanation** justifica o quadrante com 2-3 razões CONCRETAS do caso (não definição genérica do quadrante).
4. **Inteligência de mercado** (5 campos): NÃO INVENTE dados financeiros, notícias recentes ou inovações específicas se você não tiver confiança alta. Quando inferindo, marque com "Provavelmente..." ou "É comum no setor que...". Quando souber por treinamento, afirme. Cada campo deve ter 1-3 parágrafos curtos.
5. **Sumário executivo**: 2-3 parágrafos densos. Conta a história: situação atual → alavancas que vamos usar → resultado esperado em números.
6. **SWOT**: bullets CURTOS (5-10 palavras cada). Forças/Fraquezas são do COMPRADOR (não do fornecedor). Oportunidades/Ameaças são externas (mercado, regulação, concorrência).
7. **SMART** — cada letra tem texto distinto:
   - S (Específico): O QUE renegociar exatamente. Inclua produto/serviço.
   - M (Mensurável): META NUMÉRICA. R$, %, ou prazo. Não vago.
   - A (Atingível): Justifique POR QUE é atingível com referência ao mercado.
   - R (Relevante): Por que se conecta com o objetivo estratégico do comprador.
   - T (Temporal): Prazo concreto pra fechamento.

Tom: técnico, direto, sênior. Sem chavões. Sem "vamos explorar este tema fascinante". Não use emojis no conteúdo (eles ficam ruins no PDF).

Idioma: PT-BR sempre. Termos técnicos em inglês (EDP, BATNA, MESO, ZOPA) são OK quando precisos.

JSON STRICT — siga EXATAMENTE o schema. Sem texto fora do JSON.`;

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
  return parts.join('\n\n');
}

const SCHEMA_HINT = `Schema esperado (TypeScript-like — output em JSON):
{
  "posture": { "label": string (1-120 chars, ex: "Colaborativa-Assertiva"), "paragraph": string (texto rico, 200-500 palavras, formato narrativo com aspas duplas envolvendo trechos diretos como o Deal Sim original) },
  "bargainingPower": { "buyer": "low"|"med"|"high", "supplier": "low"|"med"|"high" },
  "kraljic": { "quadrant": "estrategico"|"alavancavel"|"gargalo"|"nao-critico", "label": string (label completo do quadrante), "explanation": string (200-400 palavras) },
  "marketIntel": {
    "news": string (notícias recentes do fornecedor/setor — quando inferindo, marque com 'Provavelmente...'),
    "financials": string (resultados financeiros + M&A),
    "innovations": string (inovações de produto/processo recentes),
    "risks": string (riscos identificados — geopolíticos, tecnológicos, regulatórios),
    "sustainability": string (iniciativas ESG do fornecedor)
  },
  "executiveSummary": string (2-3 parágrafos densos),
  "swot": {
    "strengths": string[] (3-6 bullets curtos do COMPRADOR),
    "weaknesses": string[] (3-6 bullets curtos do COMPRADOR),
    "opportunities": string[] (3-6 bullets curtos externos),
    "threats": string[] (3-6 bullets curtos externos)
  },
  "smartGoals": {
    "specific": string, "measurable": string, "achievable": string, "relevant": string, "temporal": string
  }
}`;

export async function generateStrategy(
  params: NegotiationStrategyParams,
): Promise<NegotiationStrategyResult> {
  const ai = getOpenAI();
  const model = getOpenAIModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const summary = summarizeParams(params);
    const res = await ai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Contexto da negociação:\n\n${summary}\n\n${SCHEMA_HINT}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 4_000,
      },
      { signal: controller.signal },
    );
    const text = res.choices[0]?.message?.content ?? '';
    const parsed = NegotiationStrategyResultSchema.parse(JSON.parse(text));
    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-negotiation-strategy',
      model,
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
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
