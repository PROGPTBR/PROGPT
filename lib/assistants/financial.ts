import type { RetrievedChunk } from '@/lib/rag/types';
import type {
  FinancialParams,
  FinancialIndicators,
  FinancialRating,
  FinancialRecommendation,
  TemplateRow,
} from './types';
import { splitTemplateBody, renderPlaceholders } from './template-assembly';
import type { CompanyData } from '@/lib/db/user-company';
import type { FiscalSnapshot } from '@/lib/fiscal/snapshot';
import { indicadoresMarkdown, type IndicadoresAtuais } from '@/lib/govdata/indicadores';

// Sub-projeto 30 — Análise financeira determinística de fornecedor.
//
// Calcula um score 0-100 a partir de 4 pilares ponderados:
//   1. Liquidez Corrente (30%)
//   2. Dívida Líquida / EBITDA (30%)
//   3. Margem EBITDA (20%)
//   4. ROE (20%)
//
// O sistema calcula determinísticamente; o LLM apenas narra a justificativa
// e gera recomendação de compra + termos de pagamento sugeridos.

// ── Deterministic scoring ────────────────────────────────────────────────

export type FinancialPillars = {
  liquidity: { value?: number; points: number; weight: 0.3 };
  debt: { value?: number; points: number; weight: 0.3 };
  margin: { value?: number; points: number; weight: 0.2 };
  roe: { value?: number; points: number; weight: 0.2 };
};

export type FinancialAnalysis = {
  pillars: FinancialPillars;
  score: number; // 0-100
  rating: FinancialRating;
  recommendation: FinancialRecommendation;
  /** True when at least one pillar lacked input (score still computed but flagged). */
  incomplete: boolean;
  /** Names of pillars that lacked input. Empty when complete. */
  missingPillars: string[];
};

// Pillar 1: Liquidez Corrente — > 1.5 / 1.1-1.5 / 0.8-1.1 / < 0.8
function scoreLiquidity(v?: number): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return 0;
  if (v > 1.5) return 100;
  if (v >= 1.1) return 70;
  if (v >= 0.8) return 40;
  return 0;
}

// Pillar 2: Dívida Líquida / EBITDA — < 1 / 1-3 / 3-5 / > 5 ou EBITDA<0
function scoreDebt(divEbitda?: number, ebitda?: number): number {
  if (divEbitda === undefined || divEbitda === null || !Number.isFinite(divEbitda)) return 0;
  // EBITDA negativo invalida o ratio — pontuação zero.
  if (ebitda !== undefined && ebitda !== null && ebitda < 0) return 0;
  if (divEbitda < 1) return 100;
  if (divEbitda <= 3) return 70;
  if (divEbitda <= 5) return 30;
  return 0;
}

// Pillar 3: Margem EBITDA (%) — > 20 / 10-20 / 5-10 / < 5
function scoreMargin(pct?: number): number {
  if (pct === undefined || pct === null || !Number.isFinite(pct)) return 0;
  if (pct > 20) return 100;
  if (pct >= 10) return 70;
  if (pct >= 5) return 40;
  return 0;
}

// Pillar 4: ROE (%) — > 15 / 8-15 / 0-8 / < 0
function scoreRoe(pct?: number): number {
  if (pct === undefined || pct === null || !Number.isFinite(pct)) return 0;
  if (pct > 15) return 100;
  if (pct >= 8) return 70;
  if (pct >= 0) return 40;
  return 0;
}

function rateScore(score: number): FinancialRating {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 35) return 'caution';
  return 'poor';
}

function recommendFromRating(rating: FinancialRating): FinancialRecommendation {
  if (rating === 'excellent' || rating === 'good') return 'buy';
  if (rating === 'caution') return 'caution';
  return 'do_not_buy';
}

export function calculateFinancialScore(
  ind: FinancialIndicators,
): FinancialAnalysis {
  const liquidityPoints = scoreLiquidity(ind.liquidezCorrente);
  const debtPoints = scoreDebt(ind.dividaLiquidaEbitda, ind.ebitda);
  const marginPoints = scoreMargin(ind.margemEbitdaPct);
  const roePoints = scoreRoe(ind.roePct);

  const score =
    liquidityPoints * 0.3 +
    debtPoints * 0.3 +
    marginPoints * 0.2 +
    roePoints * 0.2;

  const missingPillars: string[] = [];
  if (ind.liquidezCorrente === undefined) missingPillars.push('Liquidez Corrente');
  if (ind.dividaLiquidaEbitda === undefined)
    missingPillars.push('Dívida Líquida / EBITDA');
  if (ind.margemEbitdaPct === undefined) missingPillars.push('Margem EBITDA');
  if (ind.roePct === undefined) missingPillars.push('ROE');

  const rating = rateScore(score);
  return {
    pillars: {
      liquidity: {
        value: ind.liquidezCorrente,
        points: liquidityPoints,
        weight: 0.3,
      },
      debt: {
        value: ind.dividaLiquidaEbitda,
        points: debtPoints,
        weight: 0.3,
      },
      margin: {
        value: ind.margemEbitdaPct,
        points: marginPoints,
        weight: 0.2,
      },
      roe: { value: ind.roePct, points: roePoints, weight: 0.2 },
    },
    score: Math.round(score * 10) / 10,
    rating,
    recommendation: recommendFromRating(rating),
    incomplete: missingPillars.length > 0,
    missingPillars,
  };
}

// ── Prompt building ──────────────────────────────────────────────────────

export const FINANCIAL_SYSTEM_PROMPT = `Você é um Analista de Risco de Crédito Bancário sênior atuando para uma área de procurement. Sua tarefa é produzir um RELATÓRIO DE ANÁLISE FINANCEIRA de um fornecedor, em português brasileiro, em formato Markdown.

## Regras de geração

1. **A pontuação financeira é INPUT DETERMINÍSTICO, não output**. O sistema já calculou o \`financialScore\` (0-100) e a pontuação de cada um dos 4 pilares (Liquidez Corrente 30%, Dívida Líquida/EBITDA 30%, Margem EBITDA 20%, ROE 20%) a partir dos indicadores fornecidos. Você verá esses valores no contexto entre \`<financial-classification>...</financial-classification>\`. NÃO recalcule, NÃO contradiga.

2. **A seção mais importante é o SUMÁRIO EXECUTIVO no topo do relatório**. Ela tem que conter, NESSA ORDEM:
   - **Linha 1 — Veredito**: 1 frase começando com "**Recomendação: <buy|caution|do_not_buy>**" + score X/100 + classificação (excellent/good/caution/poor). Ex.: "**Recomendação: buy** — score 72/100 (classificação good)."
   - **Parágrafo 2 — Diagnóstico (3-5 frases)**: sua análise crítica dos números. Identifique os 2-3 indicadores que mais pesam na decisão (positivos e negativos), explique o que eles dizem sobre a saúde financeira do fornecedor, e aponte qual é o risco principal que o comprador precisa monitorar. NÃO repita números numa lista — narre a história.
   - **Parágrafo 3 — Bottom line (2-3 frases)**: feche com a justificativa direta da recomendação. Comece com "**Recomendamos** / **Recomendamos contratar com cautela** / **Não recomendamos** a contratação deste fornecedor porque..." e explique o porquê em termos práticos pra um comprador (prazo seguro de exposição, garantia exigida, gatilho de reavaliação).

3. **Siga o restante do template como esqueleto**. Após o Sumário Executivo: análise por pilar (4 seções), demonstrativo resumido (8 outros indicadores), recomendação de compra (re-detalhada), termos de pagamento, análise de risco de falência, sinais a monitorar.

4. **Para cada um dos 4 pilares**, escreva 1-2 parágrafos explicando:
   - O que o valor observado significa em termos de saúde financeira
   - Comparação com benchmarks típicos do setor (sem inventar números)
   - Implicação direta para o comprador (risco de inadimplência, capacidade de honrar contratos, capital de giro)

5. **Para os outros 8 indicadores** (Receita Líquida, EBITDA, Lucro Líquido, Margem Líquida, Patrimônio Líquido, ROIC, Endividamento Geral, Fluxo de Caixa Operacional): inclua-os na seção "Demonstrativo resumido" e comente quaisquer sinais relevantes (queda brusca de receita, ROIC menor que custo de capital típico, FCO negativo, etc.).

6. **Recomendação de compra** baseada na pontuação:
   - **buy** (excellent/good, score ≥ 60): contratar com prazos normais
   - **caution** (caution, 35 ≤ score < 60): contratar com prazos curtos, garantias adicionais, monitoramento
   - **do_not_buy** (poor, score < 35): risco de inadimplência alto — não contratar sem garantias estruturadas

7. **Termos de pagamento sugeridos**: baseado no score, sugira prazo (à vista / 7 / 14 / 30 / 45 / 60 / 90 dias), exigência de garantia (não / nota promissória / fiança bancária / seguro de crédito), e limite de exposição (% do faturamento mensal estimado).

8. **Análise de risco de falência**: a partir dos indicadores combinados (especialmente endividamento geral, FCO, liquidez), classifique o risco (baixo / médio / alto) e justifique. NÃO use modelos específicos (Altman Z-score) a menos que tenha confiança nos inputs.

9. **Use a base de conhecimento (se houver)** para enriquecer com princípios de análise de crédito. NÃO cite autores ou IDs.

10. **Não invente valores ausentes**. Quando um indicador está marcado como N/D no contexto, mencione a ausência em vez de inventar. Score já foi calculado descontando pilares ausentes (pontuação 0 nesses pilares).

11. **Formato Markdown limpo**. Headings (#, ##), tabelas para o demonstrativo resumido e o scorecard, **bold** para destaques. Sem preâmbulo conversacional. Comece direto pelo título do relatório.

12. **Saúde fiscal/cadastral (quando houver \`<dados-fiscais>\`)**: o contexto pode trazer situação cadastral na Receita e um score de risco fiscal do CNPJ. Combine com a saúde financeira numa seção curta "Situação fiscal/cadastral": uma situação **diferente de ATIVA** (suspensa, inapta, baixada) é um **alerta grave** que pesa contra a contratação INDEPENDENTE de bons indicadores financeiros — sinalize com destaque. Se os dados fiscais não vieram, não invente — apenas siga com a análise financeira.`;

function formatIndicator(v: number | undefined, suffix = ''): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return 'N/D';
  const formatted =
    Math.abs(v) >= 100
      ? v.toFixed(0)
      : Math.abs(v) >= 10
        ? v.toFixed(1)
        : v.toFixed(2);
  return `${formatted}${suffix}`;
}

function formatIndicatorsBlock(ind: FinancialIndicators): string {
  return [
    `- **Receita Líquida**: R$ ${formatIndicator(ind.receitaLiquida)} MM`,
    `- **EBITDA**: R$ ${formatIndicator(ind.ebitda)} MM`,
    `- **Lucro Líquido**: R$ ${formatIndicator(ind.lucroLiquido)} MM`,
    `- **Margem Líquida**: ${formatIndicator(ind.margemLiquidaPct, '%')}`,
    `- **Margem EBITDA**: ${formatIndicator(ind.margemEbitdaPct, '%')}`,
    `- **Dívida Líquida / EBITDA**: ${formatIndicator(ind.dividaLiquidaEbitda, 'x')}`,
    `- **Liquidez Corrente**: ${formatIndicator(ind.liquidezCorrente)}`,
    `- **Patrimônio Líquido**: R$ ${formatIndicator(ind.patrimonioLiquido)} MM`,
    `- **ROE**: ${formatIndicator(ind.roePct, '%')}`,
    `- **ROIC**: ${formatIndicator(ind.roicPct, '%')}`,
    `- **Endividamento Geral**: ${formatIndicator(ind.endividamentoGeralPct, '%')}`,
    `- **Fluxo de Caixa Operacional**: R$ ${formatIndicator(ind.fluxoCaixaOperacional)} MM`,
  ].join('\n');
}

function formatAnalysisBlock(a: FinancialAnalysis): string {
  return [
    `**Score Financeiro: ${a.score}/100** — classificação: **${a.rating}** — recomendação: **${a.recommendation}**`,
    '',
    `**Pontuação por pilar (peso × pontos):**`,
    `- Liquidez Corrente (30%): ${a.pillars.liquidity.points} pts — valor: ${formatIndicator(a.pillars.liquidity.value)}`,
    `- Dívida Líquida/EBITDA (30%): ${a.pillars.debt.points} pts — valor: ${formatIndicator(a.pillars.debt.value, 'x')}`,
    `- Margem EBITDA (20%): ${a.pillars.margin.points} pts — valor: ${formatIndicator(a.pillars.margin.value, '%')}`,
    `- ROE (20%): ${a.pillars.roe.points} pts — valor: ${formatIndicator(a.pillars.roe.value, '%')}`,
    '',
    `Fórmula: (${a.pillars.liquidity.points} × 0.3) + (${a.pillars.debt.points} × 0.3) + (${a.pillars.margin.points} × 0.2) + (${a.pillars.roe.points} × 0.2) = ${a.score}`,
    a.incomplete
      ? `\n⚠️ Pilares sem dado (pontuação zero atribuída): ${a.missingPillars.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(nenhum trecho relevante recuperado — fundamentar em princípios gerais de análise de crédito corporativo)';
  }
  return chunks
    .map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

const RISK_LABEL: Record<string, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
};

// Bloco de saúde fiscal/cadastral injetado quando o CNPJ foi consultado.
function fiscalBlock(fiscal: FiscalSnapshot | null): string {
  if (!fiscal || !fiscal.enabled || !fiscal.available) return '';
  const d = fiscal.cnpjData;
  const r = fiscal.risk;
  const lines = [
    d ? `- **Situação cadastral (Receita)**: ${d.situacao_cadastral}` : '',
    d ? `- **Razão social**: ${d.razao_social}` : '',
    d?.natureza_juridica ? `- **Natureza jurídica**: ${d.natureza_juridica}` : '',
    d?.endereco?.municipio && d.endereco.uf
      ? `- **Município/UF**: ${d.endereco.municipio}/${d.endereco.uf}`
      : '',
    r ? `- **Score de risco fiscal**: ${r.score}/100 (${RISK_LABEL[r.risco] ?? r.risco})` : '',
    r ? `- **Recomendação fiscal**: ${r.recomendacao}` : '',
  ].filter(Boolean);
  return `## Dados fiscais/cadastrais (Receita) — INPUT, combine com a análise financeira

<dados-fiscais>
${lines.join('\n')}
</dados-fiscais>`;
}

export function buildFinancialPrompt(
  params: FinancialParams,
  template: TemplateRow,
  chunks: RetrievedChunk[],
  analysis: FinancialAnalysis,
  company: CompanyData | null = null,
  fiscal: FiscalSnapshot | null = null,
  macro: IndicadoresAtuais | null = null,
): { system: string; user: string } {
  const companyBlock = company
    ? [
        company.company_name
          ? `- **Comprador (nome fantasia)**: ${company.company_name}`
          : '',
        company.company_legal_name
          ? `- **Comprador (razão social)**: ${company.company_legal_name}`
          : '',
        company.company_description
          ? `- **Sobre o comprador**: ${company.company_description}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const paramsBlock = `## Fornecedor analisado

- **Razão social / nome**: ${params.supplierName}
${params.cnpj ? `- **CNPJ**: ${params.cnpj}` : ''}
${params.referenceYear ? `- **Ano de referência**: ${params.referenceYear}` : ''}
${params.observacoes ? `- **Observações do comprador**: ${params.observacoes}` : ''}${
    companyBlock
      ? `\n\n## Empresa do comprador (referência)\n\n${companyBlock}`
      : ''
  }`;

  const indicatorsBlock = `## Indicadores financeiros (12)

${formatIndicatorsBlock(params.indicators)}`;

  const analysisBlock = `## Classificação determinística (NÃO recalcular)

<financial-classification>
${formatAnalysisBlock(analysis)}
</financial-classification>`;

  const { head } = splitTemplateBody(template.body_md);
  const renderedHead = renderPlaceholders(head, params, company);
  const templateBlock = `## Template a seguir

Nome do template: **${template.name}**
${template.description ? `Descrição: ${template.description}\n` : ''}
\`\`\`markdown
${renderedHead}
\`\`\``;

  const contextBlock = `## Contexto da base de conhecimento (use para fundamentar, NÃO cite)

${formatChunks(chunks)}`;

  const instruction = `## Tarefa

Gere o relatório de análise financeira agora. Comece direto pelo título. Para cada um dos 4 pilares: explique o valor, dê benchmark típico (sem inventar), traduza em risco para o comprador. Inclua os outros 8 indicadores na seção "Demonstrativo resumido". Feche com recomendação de compra (buy/caution/do_not_buy), termos de pagamento sugeridos e classificação de risco de falência. Markdown limpo.`;

  // Contexto macroeconômico (BACEN) — opcional, fail-soft. Vazio se indisponível.
  const macroBlock = macro ? indicadoresMarkdown(macro) : '';

  return {
    system: FINANCIAL_SYSTEM_PROMPT,
    user: [
      paramsBlock,
      indicatorsBlock,
      analysisBlock,
      fiscalBlock(fiscal),
      macroBlock,
      templateBlock,
      contextBlock,
      instruction,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n'),
  };
}
