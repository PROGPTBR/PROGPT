import type { ScorecardParams, ClassifiedSupplier, ScorecardBand, TemplateRow } from './types';
import { SCORECARD_BAND_LABELS } from './types';
import type { RetrievedChunk } from '@/lib/rag/types';
import type { CompanyData } from '@/lib/db/user-company';
import { splitTemplateBody, renderPlaceholders } from './template-assembly';

export function scoreSuppliers(params: ScorecardParams): ClassifiedSupplier[] {
  const totalWeight = params.criteria.reduce((a, c) => a + c.weight, 0) || 1;
  const scored = params.suppliers.map((s) => {
    const weighted = params.criteria.reduce((acc, c) => {
      const raw = s.scores[c.id] ?? 0;
      return acc + (raw / 10) * (c.weight / totalWeight);
    }, 0);
    const weightedScore = Number((weighted * 100).toFixed(1));
    return { supplier: s, weightedScore };
  });
  const ordered = scored
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => b.weightedScore - a.weightedScore || a.i - b.i);
  const { strategic, development } = params.thresholds;
  return ordered.map((x, idx) => ({
    ...x.supplier,
    weightedScore: x.weightedScore,
    rank: idx + 1,
    band: bandFor(x.weightedScore, strategic, development),
  }));
}

function bandFor(score: number, strategic: number, development: number): ScorecardBand {
  if (score >= strategic) return 'estrategico';
  if (score >= development) return 'desenvolvimento';
  return 'saida';
}

// ── Prompt builder ───────────────────────────────────────────────────────

export const SCORECARD_SYSTEM_PROMPT = `Você é um especialista sênior em Strategic Sourcing e SRM (Supplier Relationship Management) com 20 anos de experiência. Sua tarefa é INTERPRETAR um scorecard de fornecedores já pontuado e ranqueado, e produzir um relatório executivo em português brasileiro.

## Regras
1. **Classificação é INPUT, não output.** Cada fornecedor já vem com score ponderado (0–100), posição no ranking e faixa (Estratégico, Desenvolvimento, Saída). NÃO recalcule scores nem reclassifique.
2. **Template já chega com placeholders resolvidos.** Não preencha {{...}}.
3. **Plano de ação por faixa:**
   - **Estratégico**: parceria de longo prazo, QBR, co-desenvolvimento, joint roadmap, contrato plurianual com governança.
   - **Desenvolvimento**: plano de melhoria com metas SMART, cadência de revisão, suporte técnico, gatilhos de escalonamento.
   - **Saída**: dual-sourcing, plano de substituição, desmobilização com mitigação de risco de suprimento.
4. **Profundidade sênior**: threshold numérico, ferramenta concreta, cadência. Evite generalidades.
5. **Sem preâmbulo conversacional**; comece pelo título.
6. **Não invente dados de fornecedor**; quando faltar fundamento, use "o comprador definirá".
7. **Use a base de conhecimento (SRM, Cousins, supplier segmentation)** para fundamentar, sem citar autores/IDs.
8. **Markdown limpo**: headings, tabelas markdown, **bold** para valores críticos.`;

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(nenhum trecho relevante recuperado — fundamentar em princípios gerais de SRM e supplier segmentation)';
  }
  return chunks
    .map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

export function buildScorecardPrompt(
  params: ScorecardParams,
  classified: ClassifiedSupplier[],
  template: TemplateRow,
  chunks: RetrievedChunk[],
  company: CompanyData | null = null,
): { system: string; user: string } {
  // Build criteria+weights summary
  const totalWeight = params.criteria.reduce((a, c) => a + c.weight, 0) || 1;
  const criteriaLines = params.criteria
    .map((c) => `- **${c.label}**: ${((c.weight / totalWeight) * 100).toFixed(1)}%`)
    .join('\n');

  // Build ranking table
  const tableHeader = '| Rank | Fornecedor | Segmento | Score | Faixa |';
  const tableSep    = '|---|---|---|---|---|';
  const tableRows = classified
    .map((s) => {
      const seg = s.segment ? s.segment : '—';
      const faixa = SCORECARD_BAND_LABELS[s.band];
      return `| ${s.rank} | ${s.name} | ${seg} | ${s.weightedScore} | ${faixa} |`;
    })
    .join('\n');

  const dataBlock = `## Scorecard: ${params.scorecardName}
${params.period ? `\n- **Período**: ${params.period}` : ''}
${params.notes ? `\n- **Notas**: ${params.notes}` : ''}

### Critérios e pesos (já normalizados)

${criteriaLines}

### Ranking de fornecedores (classificação como INPUT)

${tableHeader}
${tableSep}
${tableRows}`;

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
  const renderedHead = renderPlaceholders(
    head,
    {
      client: company?.company_name ?? '',
      scope: params.scorecardName,
      category: 'Scorecard de fornecedores',
      deadline: '',
      // sem eixo de spend no scorecard — {{budget}} fica em branco de propósito
      budget: '',
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

Gere o relatório executivo agora seguindo o template. NÃO recalcule scores (já feito). NÃO recrie o gráfico de ranking (será inserido automaticamente como imagem). Produza comparativo + plano de ação por fornecedor, com foco nos fornecedores Estratégico e Saída.`;

  return {
    system: SCORECARD_SYSTEM_PROMPT,
    user: [
      dataBlock,
      companyBlock ? `## Empresa do comprador\n\n${companyBlock}` : '',
      templateBlock,
      contextBlock,
      instruction,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n'),
  };
}
