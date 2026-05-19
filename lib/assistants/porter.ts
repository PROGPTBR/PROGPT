import type { RetrievedChunk } from '@/lib/rag/types';
import type {
  PorterParams,
  PorterForce,
  PorterStatementScore,
  TemplateRow,
} from './types';
import { PORTER_FORCE_LABELS } from './types';
import {
  PORTER_STATEMENTS,
  PORTER_FORCES_ORDERED,
  PORTER_INTENSITY_LABELS,
  intensityFromScore,
  type PorterIntensity,
  type PorterStatement,
} from './porter-statements';
import { splitTemplateBody, renderPlaceholders } from './template-assembly';
import type { CompanyData } from '@/lib/db/user-company';

// Sub-projeto 29 v2 — Assistente das 5 Forças de Porter
// (modelo Procurement Garage).
//
// Diferente da v1 (puro LLM), agora segue o padrão do Kraljic:
//   - Form quantitativo com 35 afirmações canônicas (peso 0-3 + nota 1-5)
//   - Classificação DETERMINÍSTICA: média ponderada por força → intensidade
//     (baixa < 2 ≤ média < 3.5 ≤ alta)
//   - LLM gera APENAS a narrativa, ancorada nas intensidades calculadas.
//     Não reclassifica nem inventa drivers — o framework Porter já fixou
//     as 35 afirmações.

export const PORTER_SYSTEM_PROMPT = `Você é um especialista sênior em estratégia competitiva e procurement, com 20 anos de experiência aplicando o framework de Porter (1979, 1985) para decisões de sourcing. Seu trabalho é gerar a NARRATIVA de uma análise das 5 Forças de Porter em português brasileiro.

## Regras de geração

1. **A classificação das forças é INPUT, não output**. O usuário pontuou 35 afirmações canônicas (peso 0-3 × nota 1-5) e o sistema calculou a intensidade de cada força (baixa/média/alta) deterministicamente. Você verá essas intensidades no contexto entre \`<porter-classification>...</porter-classification>\` — NÃO reclassifique nem contradiga.

2. **Siga o template fornecido como esqueleto**. Mantenha as seções na ordem; placeholders já estão resolvidos.

3. **Para cada uma das 5 forças**, escreva uma análise narrativa cobrindo:
   - Os drivers concretos que justificam a intensidade calculada (cite as afirmações com maior peso × nota dentro daquela força — elas estão no contexto)
   - Implicação para o comprador (como aproveitar/mitigar)

4. **Use a base de conhecimento para enriquecer**. Há trechos canônicos no contexto (Porter, Cox, Cousins, Williamson). Incorpore as ideias como conhecimento próprio — NÃO cite autores, IDs ou números entre colchetes na saída.

5. **Síntese estratégica final**: tabela markdown com as 5 forças × intensidade + 2-3 frases de "atratividade geral do setor" + 3-5 movimentos concretos para o próximo ciclo de sourcing (ação + porquê + KPI).

6. **Formato Markdown bem estruturado**. Headings (#, ##), tabelas, **bold** para termos técnicos. Sem preâmbulo conversacional. Comece direto pelo título da análise.

7. **Não invente players, market shares ou números de mercado** que não estejam no contexto. Use linguagem como "tipicamente, neste perfil de setor, observa-se…" quando não houver dado específico.`;

// ── Classification (deterministic) ────────────────────────────────────────

export type ForceClassification = {
  force: PorterForce;
  label: string;
  weightedAvg: number; // 1..5 (or NaN→0 when all weights were 0)
  intensity: PorterIntensity;
  // Top 2-3 statements (by weight × score) within the force, surfaced
  // for the LLM so it cites the actual drivers behind the intensity.
  topDrivers: Array<{ id: string; text: string; weight: number; score: number }>;
};

export type PorterClassification = {
  byForce: ForceClassification[];
  overallAvg: number; // simple average of the 5 force avgs (1..5)
  overallIntensity: PorterIntensity;
};

/**
 * Compute per-force weighted average + overall sector pressure from the
 * 35 statement scorings. Statements with weight=0 are excluded from the
 * weighted average so a "not applicable" mark doesn't drag the score
 * toward the user's default Likert.
 */
export function classifyPorterForces(
  scores: PorterStatementScore[],
): PorterClassification {
  const byId = new Map<string, PorterStatement>(
    PORTER_STATEMENTS.map((s) => [s.id, s]),
  );
  const scoresByForce: Record<PorterForce, PorterStatementScore[]> = {
    'poder-fornecedor': [],
    'poder-comprador': [],
    'novos-entrantes': [],
    substitutos: [],
    rivalidade: [],
  };
  for (const s of scores) {
    const stmt = byId.get(s.id);
    if (!stmt) continue;
    scoresByForce[stmt.force].push(s);
  }

  const byForce: ForceClassification[] = PORTER_FORCES_ORDERED.map((force) => {
    const list = scoresByForce[force];
    const sumWeight = list.reduce((a, s) => a + s.weight, 0);
    const sumWeighted = list.reduce((a, s) => a + s.weight * s.score, 0);
    const weightedAvg = sumWeight > 0 ? sumWeighted / sumWeight : 0;

    const topDrivers = list
      .filter((s) => s.weight > 0)
      .map((s) => ({
        id: s.id,
        text: byId.get(s.id)?.text ?? '',
        weight: s.weight,
        score: s.score,
        product: s.weight * s.score,
      }))
      .sort((a, b) => b.product - a.product)
      .slice(0, 3)
      .map(({ id, text, weight, score }) => ({ id, text, weight, score }));

    return {
      force,
      label: PORTER_FORCE_LABELS[force],
      weightedAvg,
      intensity: intensityFromScore(weightedAvg),
      topDrivers,
    };
  });

  const validAvgs = byForce.filter((f) => f.weightedAvg > 0);
  const overallAvg =
    validAvgs.length > 0
      ? validAvgs.reduce((a, f) => a + f.weightedAvg, 0) / validAvgs.length
      : 0;

  return {
    byForce,
    overallAvg,
    overallIntensity: intensityFromScore(overallAvg),
  };
}

// ── Prompt building ───────────────────────────────────────────────────────

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(nenhum trecho relevante recuperado — fundamentar em princípios gerais de Porter 1979)';
  }
  return chunks
    .map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

function formatClassification(cls: PorterClassification): string {
  const lines: string[] = [];
  lines.push(
    `**Atratividade geral do setor**: ${PORTER_INTENSITY_LABELS[cls.overallIntensity]} pressão das forças (média ${cls.overallAvg.toFixed(2)} numa escala 1-5; quanto maior, mais desfavorável ao comprador).`,
  );
  lines.push('');
  for (const f of cls.byForce) {
    const intensityLabel = PORTER_INTENSITY_LABELS[f.intensity];
    lines.push(`### ${f.label}`);
    lines.push(
      `- Intensidade calculada: **${intensityLabel}** (média ${f.weightedAvg.toFixed(2)})`,
    );
    if (f.topDrivers.length === 0) {
      lines.push('- Drivers dominantes: (nenhuma afirmação com peso > 0)');
    } else {
      lines.push('- Drivers dominantes (peso × nota):');
      for (const d of f.topDrivers) {
        lines.push(
          `  - "${d.text}" (peso ${d.weight}, nota ${d.score})`,
        );
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function buildPorterPrompt(
  params: PorterParams,
  template: TemplateRow,
  chunks: RetrievedChunk[],
  classification: PorterClassification,
  company: CompanyData | null = null,
): { system: string; user: string } {
  const companyBlock = company
    ? [
        company.company_name ? `- **Nome fantasia**: ${company.company_name}` : '',
        company.company_legal_name
          ? `- **Razão social**: ${company.company_legal_name}`
          : '',
        company.company_description
          ? `- **Descrição da empresa**: ${company.company_description}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const paramsBlock = `## Parâmetros da análise (fornecidos pelo comprador)

- **Categoria**: ${params.categoria}
${params.segmento ? `- **Segmento**: ${params.segmento}` : ''}
${params.escopo ? `- **Escopo (geográfico/mercado)**: ${params.escopo}` : ''}
${params.observacoes ? `- **Observações adicionais**: ${params.observacoes}` : ''}${
    companyBlock
      ? `\n\n## Empresa do comprador (referência)\n\n${companyBlock}`
      : ''
  }`;

  const classificationBlock = `## Classificação calculada (determinística — NÃO contradizer)

<porter-classification>
${formatClassification(classification)}
</porter-classification>`;

  const { head } = splitTemplateBody(template.body_md);
  const renderedHead = renderPlaceholders(head, params, company);
  const templateBlock = `## Template a seguir (estrutura obrigatória — apenas as seções customizáveis)

Nome do template: **${template.name}**
${template.description ? `Descrição: ${template.description}\n` : ''}
\`\`\`markdown
${renderedHead}
\`\`\``;

  const contextBlock = `## Contexto da base de conhecimento (use para fundamentar, NÃO cite)

${formatChunks(chunks)}`;

  const instruction = `## Tarefa

Gere a análise das 5 Forças de Porter agora, RESPEITANDO as intensidades já calculadas no bloco \`<porter-classification>\`. Comece direto pelo título. Para cada força, escreva 1-2 parágrafos justificando a intensidade calculada (usando os drivers dominantes citados) e a implicação prática para o comprador. Feche com tabela síntese + recomendações. Produza markdown limpo.`;

  return {
    system: PORTER_SYSTEM_PROMPT,
    user: [
      paramsBlock,
      classificationBlock,
      templateBlock,
      contextBlock,
      instruction,
    ].join('\n\n---\n\n'),
  };
}
