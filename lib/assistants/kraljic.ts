import type { RetrievedChunk } from '@/lib/rag/types';
import type {
  KraljicItem,
  KraljicParams,
  ClassifiedKraljicItem,
  KraljicQuadrant,
  TemplateRow,
} from './types';
import { KRALJIC_QUADRANT_LABELS } from './types';
import { splitTemplateBody, renderPlaceholders } from './template-assembly';
import type { CompanyData } from '@/lib/db/user-company';

// Sub-projeto 27 — Assistente de Matriz de Kraljic.
//
// Methodology mirrors the Procurement Garage RFQ-Kraljic template:
//   - Eixo Y "Impacto no Negócio" (4 critérios, escala 1-4, peso 100%):
//       Spend 40% / Criticidade 30% / Especificações Técnicas 15% /
//       Valor Percebido pelo Cliente 15%.
//   - Eixo X "Complexidade Mercado Fornecedor" (4 critérios, escala 1-4,
//     peso 100%): Estrutura 25% / Rivalidade 25% / Poder Barganha 25% /
//     Substituição 25%.
//
// Spend score is derived from the item's spend share inside the portfolio
// (top 25%→4, …, bottom 25%→1) so the user enters numeric R$ MM and the
// classifier ranks it among siblings.
//
// Quadrant rule (verified against the PG template's 23 categories):
//   - impacto > 2.5 (strict)   → high impact (Y)
//   - complex >= 2.5 (inclusive) → high supply risk (X)
// The strict-vs-inclusive asymmetry matters for the boundary case (2.5, 2.5):
// the PG template lands it in Gargalo, which matches `!highI && highC`.

export const KRALJIC_WEIGHTS = {
  impacto: {
    spend: 0.4,
    criticality: 0.3,
    technicalSpec: 0.15,
    customerValue: 0.15,
  },
  complexidade: {
    marketStructure: 0.25,
    marketRivalry: 0.25,
    supplierPower: 0.25,
    supplierSwitching: 0.25,
  },
} as const;

export const KRALJIC_CRITERIA_LABELS = {
  impacto: {
    spend: 'Spend',
    criticality: 'Nível de Criticidade',
    technicalSpec: 'Especificações Técnicas',
    customerValue: 'Valor Percebido pelo Cliente Final',
  },
  complexidade: {
    marketStructure: 'Estrutura do Mercado',
    marketRivalry: 'Rivalidade do Mercado',
    supplierPower: 'Poder de Barganha do Fornecedor',
    supplierSwitching: 'Substituição de Fornecedor',
  },
} as const;

export const KRALJIC_THRESHOLDS = {
  // Asymmetric thresholds — see file header for the why.
  impactoHighWhen: 'gt2_5' as const, // impacto > 2.5
  complexHighWhen: 'gte2_5' as const, // complex >= 2.5
};

function spendShareToScore(share: number, allShares: number[]): 1 | 2 | 3 | 4 {
  // Sort descending, find this share's rank, map quartiles to 4..1.
  const sorted = [...allShares].sort((a, b) => b - a);
  const rank = sorted.findIndex((s) => s <= share); // first slot share fits
  const idx = rank === -1 ? sorted.length - 1 : rank;
  const q = idx / Math.max(1, sorted.length - 1); // 0..1, 0=top
  if (q <= 0.25) return 4;
  if (q <= 0.5) return 3;
  if (q <= 0.75) return 2;
  return 1;
}

function quadrantFor(impacto: number, complex: number): KraljicQuadrant {
  const highI = impacto > 2.5;
  const highC = complex >= 2.5;
  if (highI && highC) return 'estrategico';
  if (highI && !highC) return 'alavancavel';
  if (!highI && highC) return 'gargalo';
  return 'nao-critico';
}

export function classifyItems(items: KraljicItem[]): ClassifiedKraljicItem[] {
  const totalSpend = items.reduce((acc, it) => acc + Math.max(0, it.spendMM), 0);
  const shares = items.map((it) =>
    totalSpend === 0 ? 0 : Math.max(0, it.spendMM) / totalSpend,
  );

  return items.map((it, i) => {
    const share = shares[i]!;
    const spendScore = spendShareToScore(share, shares);

    const w = KRALJIC_WEIGHTS;
    const businessImpact =
      spendScore * w.impacto.spend +
      it.criticality * w.impacto.criticality +
      it.technicalSpec * w.impacto.technicalSpec +
      it.customerValue * w.impacto.customerValue;

    const supplyComplexity =
      it.marketStructure * w.complexidade.marketStructure +
      it.marketRivalry * w.complexidade.marketRivalry +
      it.supplierPower * w.complexidade.supplierPower +
      it.supplierSwitching * w.complexidade.supplierSwitching;

    return {
      ...it,
      spendShare: share,
      spendScore,
      businessImpact: Number(businessImpact.toFixed(2)),
      supplyComplexity: Number(supplyComplexity.toFixed(2)),
      quadrant: quadrantFor(businessImpact, supplyComplexity),
    };
  });
}

export function summarizeQuadrants(
  classified: ClassifiedKraljicItem[],
): Record<KraljicQuadrant, { count: number; spendMM: number }> {
  const out: Record<KraljicQuadrant, { count: number; spendMM: number }> = {
    estrategico: { count: 0, spendMM: 0 },
    alavancavel: { count: 0, spendMM: 0 },
    gargalo: { count: 0, spendMM: 0 },
    'nao-critico': { count: 0, spendMM: 0 },
  };
  for (const it of classified) {
    out[it.quadrant].count += 1;
    out[it.quadrant].spendMM += it.spendMM;
  }
  return out;
}

// ── Prompt builder ───────────────────────────────────────────────────────

export const KRALJIC_SYSTEM_PROMPT = `Você é um especialista sênior em procurement (compras corporativas) com 20 anos de experiência. Seu trabalho aqui é INTERPRETAR uma análise de portfólio já classificada via Matriz de Kraljic e produzir um relatório executivo em português brasileiro.

## Regras

1. **Classificação é INPUT, não output**. Cada item já vem com seu quadrante (Estratégico, Alavancável, Gargalo, Não Crítico) e seus scores nos 2 eixos. NÃO discuta a metodologia de scoring nem reclassifique itens.

2. **Template já chega com valores resolvidos**. O sistema substituiu {{cliente}}, {{categoria}}, etc. pelos valores reais antes de te enviar. Não preencha placeholders {{...}}.

3. **Aplique Kraljic 1983 por quadrante**:
   - **Estratégico** (alto impacto + alta complexidade): parceria de longo prazo, co-desenvolvimento, contratos plurianuais com governança ativa (QBR, joint roadmap), gestão ativa de risco de fornecedor único.
   - **Alavancável** (alto impacto + baixa complexidade): leilão reverso, leverage buying, RFQ competitivo, consolidação de volume, e-procurement.
   - **Gargalo** (baixo impacto + alta complexidade): garantir continuidade de suprimento, desenvolver alternativas, estoque de segurança, contratos com penalidades de SLA.
   - **Não Crítico** (baixo impacto + baixa complexidade): simplificar, automatizar P2P, agregar via catálogo, evitar atenção gerencial.

4. **Profundidade sênior**. Recomendações executáveis: threshold numérico, ferramenta concreta, cadência clara. Evite "padrão de mercado" / "boas práticas" sem ancoragem.

5. **Sem preâmbulo nem epílogo conversacional**. Comece direto pelo título.

6. **Não invente fornecedores, valores ou cláusulas**. Quando não houver fundamento, use linguagem de "o comprador definirá".

7. **Use a base de conhecimento (procurement, Kraljic 1983, Gelderman & Van Weele 2003)** para fundamentar. Não cite autores nem IDs — incorpore como conhecimento próprio.

8. **Markdown limpo**: headings, tabelas markdown para listas comparativas, bullets, **bold** para valores críticos.`;

function formatItemForPrompt(it: ClassifiedKraljicItem): string {
  const segPart = it.segment ? ` · ${it.segment}` : '';
  return [
    `- **${it.name}** (${KRALJIC_QUADRANT_LABELS[it.quadrant]})${segPart}`,
    `  spend: R$ ${it.spendMM.toFixed(2)} MM (${(it.spendShare * 100).toFixed(1)}%)`,
    `  impacto: ${it.businessImpact.toFixed(2)}, complexidade: ${it.supplyComplexity.toFixed(2)}`,
  ].join('\n');
}

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(nenhum trecho relevante recuperado — fundamentar em princípios gerais de procurement)';
  }
  return chunks
    .map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

export function buildKraljicPrompt(
  params: KraljicParams,
  classified: ClassifiedKraljicItem[],
  template: TemplateRow,
  chunks: RetrievedChunk[],
  company: CompanyData | null = null,
): { system: string; user: string } {
  const summary = summarizeQuadrants(classified);
  const totalSpend = classified.reduce((a, it) => a + it.spendMM, 0);

  const portfolioBlock = `## Portfólio analisado

- **Nome do portfólio**: ${params.portfolioName}
${params.analysisPeriod ? `- **Período da análise**: ${params.analysisPeriod}` : ''}
- **Total de itens**: ${classified.length}
- **Spend total**: R$ ${totalSpend.toFixed(2)} MM
${params.notes ? `- **Notas adicionais**: ${params.notes}` : ''}

### Distribuição por quadrante

| Quadrante | # itens | Spend (R$ MM) | % do portfólio |
|---|---|---|---|
| Estratégico | ${summary.estrategico.count} | ${summary.estrategico.spendMM.toFixed(2)} | ${totalSpend ? ((summary.estrategico.spendMM / totalSpend) * 100).toFixed(1) : '0.0'}% |
| Alavancável | ${summary.alavancavel.count} | ${summary.alavancavel.spendMM.toFixed(2)} | ${totalSpend ? ((summary.alavancavel.spendMM / totalSpend) * 100).toFixed(1) : '0.0'}% |
| Gargalo | ${summary.gargalo.count} | ${summary.gargalo.spendMM.toFixed(2)} | ${totalSpend ? ((summary.gargalo.spendMM / totalSpend) * 100).toFixed(1) : '0.0'}% |
| Não Crítico | ${summary['nao-critico'].count} | ${summary['nao-critico'].spendMM.toFixed(2)} | ${totalSpend ? ((summary['nao-critico'].spendMM / totalSpend) * 100).toFixed(1) : '0.0'}% |

### Itens individuais (já classificados)

${classified.map(formatItemForPrompt).join('\n\n')}`;

  const companyBlock = company
    ? [
        company.company_name ? `- **Empresa**: ${company.company_name}` : '',
        company.company_legal_name ? `- **Razão social**: ${company.company_legal_name}` : '',
        company.company_cnpj ? `- **CNPJ**: ${company.company_cnpj}` : '',
        company.company_description
          ? `- **Descrição**: ${company.company_description}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const { head } = splitTemplateBody(template.body_md);
  // The head may use placeholders aliased to RFP semantics (cliente,
  // empresa_*). We synthesize a thin "RfpParams-like" object so the
  // shared renderPlaceholders helper works without bifurcation.
  const renderedHead = renderPlaceholders(
    head,
    {
      client: company?.company_name ?? '',
      scope: params.portfolioName,
      category: 'Análise de portfólio (Kraljic)',
      deadline: '',
      budget: `R$ ${totalSpend.toFixed(2)} MM (spend total)`,
      criteria: [],
      notes: params.notes ?? '',
    },
    company,
  );

  const templateBlock = `## Template a seguir (estrutura obrigatória — apenas as seções customizáveis)

Nome do template: **${template.name}**
${template.description ? `Descrição: ${template.description}\n` : ''}
\`\`\`markdown
${renderedHead}
\`\`\``;

  const contextBlock = `## Contexto da base de conhecimento (use para fundamentar, NÃO cite)

${formatChunks(chunks)}`;

  const instruction = `## Tarefa

Gere o relatório executivo agora, seguindo o template. NÃO classifique itens (isso já está feito), NÃO recrie a matriz visual (será inserida automaticamente como imagem), NÃO invente cláusulas legais (serão acrescentadas pelo sistema). Produza markdown limpo com resumo executivo, análise por quadrante e recomendação item-a-item para os itens Estratégico e Gargalo (os mais relevantes para ação).`;

  return {
    system: KRALJIC_SYSTEM_PROMPT,
    user: [
      portfolioBlock,
      companyBlock ? `## Empresa do comprador\n\n${companyBlock}` : '',
      templateBlock,
      contextBlock,
      instruction,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n'),
  };
}
