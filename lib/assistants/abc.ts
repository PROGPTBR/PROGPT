import type { RetrievedChunk } from '@/lib/rag/types';
import type {
  AbcAnalysis,
  AbcClass,
  AbcClassSummary,
  AbcItem,
  AbcParams,
  ClassifiedAbcItem,
  TemplateRow,
} from './types';
import { splitTemplateBody, renderPlaceholders } from './template-assembly';
import type { CompanyData } from '@/lib/db/user-company';

// Sub-projeto 31 — Análise ABC / Curva de Pareto.
//
// Mesma divisão do Kraljic: classificação determinística + narrativa LLM.
// O LLM nunca reclassifica; só explica os resultados, fornece plano de
// ação por classe e identifica oportunidades de consolidação.

// Default Pareto thresholds — A = top 80% cum, B = 80-95% cum, C = > 95%.
// Hard-coded for v1; a future param could let admins customize.
const CLASS_A_THRESHOLD = 0.8;
const CLASS_B_THRESHOLD = 0.95;

// ── Deterministic classification ─────────────────────────────────────────

/**
 * Consolidate items by name (sum quantity, sum spend, keep first supplier
 * + category + unit). Used when params.consolidate=true (default) — most
 * spend exports have the same SKU repeated across many POs and the user
 * expects A/B/C per SKU.
 */
export function consolidateItems(items: AbcItem[]): AbcItem[] {
  const map = new Map<string, AbcItem>();
  for (const it of items) {
    const key = it.name.trim().toLowerCase();
    const prev = map.get(key);
    if (prev) {
      map.set(key, {
        ...prev,
        quantity:
          prev.quantity !== undefined && it.quantity !== undefined
            ? prev.quantity + it.quantity
            : (prev.quantity ?? it.quantity),
        spend: prev.spend + it.spend,
      });
    } else {
      map.set(key, { ...it });
    }
  }
  return Array.from(map.values());
}

export function classifyAbc(params: AbcParams): AbcAnalysis {
  const source = params.consolidate
    ? consolidateItems(params.items)
    : params.items.slice();

  // Sort descending by spend (stable across equal-spend items by name).
  source.sort((a, b) => {
    if (b.spend !== a.spend) return b.spend - a.spend;
    return a.name.localeCompare(b.name);
  });

  const totalSpend = source.reduce((acc, it) => acc + it.spend, 0);
  const totalItems = source.length;

  let cumulative = 0;
  const items: ClassifiedAbcItem[] = source.map((it, idx) => {
    const share = totalSpend > 0 ? it.spend / totalSpend : 0;
    cumulative += share;
    let abcClass: AbcClass;
    // Inclusive thresholds: an item that *crosses* 80% from below still
    // belongs to A; one that crosses 95% still belongs to B. Matches the
    // PG template convention.
    if (cumulative <= CLASS_A_THRESHOLD + 1e-9) abcClass = 'A';
    else if (cumulative <= CLASS_B_THRESHOLD + 1e-9) abcClass = 'B';
    else abcClass = 'C';
    return {
      name: it.name,
      supplier: it.supplier ?? '',
      category: it.category ?? '',
      quantity: it.quantity,
      unit: it.unit ?? '',
      spend: it.spend,
      rank: idx + 1,
      share,
      cumulativeShare: cumulative,
      abcClass,
    };
  });

  // Handle the edge case where the first item alone > 80% — it should
  // still be A (and the next ones go to B or C). The loop above already
  // does this correctly because cumulative starts at 0 + first.share.
  // But if there's only 1 item, force it into A.
  if (items.length === 1 && items[0]) items[0].abcClass = 'A';

  const byClass: Record<AbcClass, AbcClassSummary> = {
    A: emptySummary(),
    B: emptySummary(),
    C: emptySummary(),
  };
  for (const it of items) {
    const c = byClass[it.abcClass];
    c.count += 1;
    c.totalSpend += it.spend;
  }
  for (const c of ['A', 'B', 'C'] as AbcClass[]) {
    byClass[c].spendShare =
      totalSpend > 0 ? byClass[c].totalSpend / totalSpend : 0;
    byClass[c].itemShare = totalItems > 0 ? byClass[c].count / totalItems : 0;
  }

  return { items, totalSpend, totalItems, byClass };
}

function emptySummary(): AbcClassSummary {
  return { count: 0, totalSpend: 0, spendShare: 0, itemShare: 0 };
}

// ── Prompt building ──────────────────────────────────────────────────────

export const ABC_SYSTEM_PROMPT = `Você é um especialista sênior em procurement com 20 anos de experiência em análise de spend e gestão de portfólio. Sua tarefa é produzir um relatório de Análise ABC (Curva de Pareto) em português brasileiro, em formato Markdown.

## Regras de geração

1. **A classificação ABC é INPUT DETERMINÍSTICO, não output**. O sistema já ordenou os itens por spend descendente, calculou o cumulativo, e atribuiu A (top 80% cumulativo) / B (80-95%) / C (> 95%). Você verá os totais por classe + os top items de cada classe no contexto entre \`<abc-classification>...</abc-classification>\`. NÃO recalcule, NÃO reclassifique, NÃO contradiga.

2. **A seção mais importante é o SUMÁRIO EXECUTIVO no topo**, estruturado em 3 blocos:
   - **Linha 1 — Veredito**: 1 frase começando com "**Concentração de spend: <alta | média | baixa>**" + "X% do spend em Y% dos itens (classe A)". Ex.: "**Concentração de spend: alta** — 80% do gasto em 18% dos itens (classe A: 27 SKUs de 150)."
   - **Parágrafo 2 — Diagnóstico (3-5 frases)**: narre o perfil do portfólio. Identifique os 2-3 itens (ou fornecedores) mais relevantes da classe A, comente a cauda longa (classe C), e aponte o principal indício de oportunidade ou risco (ex.: "Item X sozinho representa 25% do spend total — alvo claro de renegociação", "300 SKUs em classe C — oportunidade de consolidação de pedidos").
   - **Parágrafo 3 — Ação prioritária (2-3 frases)**: comece com "**Priorizar:**" e liste 2-3 movimentos concretos com horizonte (próximos 30/60/90 dias).

3. **Plano de ação por classe (4 seções)**:

   ### Classe A — Gestão estratégica intensiva
   Para os itens A: Kraljic-style management. Sourcing competitivo, contratos de longo prazo, QBR ativo, plano de mitigação de fornecedor único. Cite os 3-5 maiores itens por nome.

   ### Classe B — Gestão operacional
   Para os itens B: monitoramento padrão, RFQ trimestral, manter 2-3 fornecedores qualificados. Em transição A↔C ao longo do tempo.

   ### Classe C — Automatização e agregação
   Para os itens C: P2P automatizado, catálogo eletrônico, consolidação de pedidos (passar de N pedidos pequenos para M pedidos maiores), terceirização de gestão pra distribuidor. Reduzir custo de transação > custo do material.

   ### Cauda longa e quick wins
   Identifique padrões: muitos itens de fornecedor único na classe C? Mesmo material descrito em 5 SKUs diferentes (oportunidade de catalogação)? Itens C de alta frequência (alvos de consolidação por volume)?

4. **Fundamente em teoria quando útil**. Há trechos da base entre \`<base>...</base>\`. Use princípios de spend cube, consolidação de fornecedor, lei de Pareto, gestão de capital de giro. NÃO cite autores ou IDs.

5. **Não invente fornecedores, valores ou padrões** que não estão nos dados. Se um campo está vazio (supplier=""), mencione a ausência em vez de inventar.

6. **Formato Markdown limpo**. Headings (#, ##), tabelas para o resumo por classe, **bold** para itens-chave por nome. Sem preâmbulo conversacional. Comece direto pelo título.`;

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

function topItemsBlock(items: ClassifiedAbcItem[], n: number): string {
  if (items.length === 0) return '_(sem itens nesta classe)_';
  return items
    .slice(0, n)
    .map(
      (it) =>
        `- **${it.name}**${it.supplier ? ` (fornecedor: ${it.supplier})` : ''}: R$ ${formatBRL(it.spend)} (${formatPct(it.share)} do total, posição #${it.rank})`,
    )
    .join('\n');
}

function formatClassificationBlock(analysis: AbcAnalysis): string {
  const lines: string[] = [];
  lines.push(
    `**Totais**: ${analysis.totalItems} itens distintos · spend total R$ ${formatBRL(analysis.totalSpend)}`,
  );
  lines.push('');
  lines.push('**Resumo por classe:**');
  for (const c of ['A', 'B', 'C'] as AbcClass[]) {
    const s = analysis.byClass[c];
    lines.push(
      `- **Classe ${c}**: ${s.count} itens (${formatPct(s.itemShare)} dos itens) · R$ ${formatBRL(s.totalSpend)} (${formatPct(s.spendShare)} do spend)`,
    );
  }
  lines.push('');
  for (const c of ['A', 'B', 'C'] as AbcClass[]) {
    const itemsOfClass = analysis.items.filter((it) => it.abcClass === c);
    lines.push(`**Top itens da classe ${c}:**`);
    lines.push(topItemsBlock(itemsOfClass, c === 'A' ? 10 : 5));
    lines.push('');
  }
  return lines.join('\n');
}

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(nenhum trecho relevante recuperado — fundamentar em princípios gerais de spend analysis e curva ABC/Pareto)';
  }
  return chunks
    .map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

export function buildAbcPrompt(
  params: AbcParams,
  template: TemplateRow,
  chunks: RetrievedChunk[],
  analysis: AbcAnalysis,
  company: CompanyData | null = null,
): { system: string; user: string } {
  const companyBlock = company
    ? [
        company.company_name ? `- **Comprador**: ${company.company_name}` : '',
        company.company_description
          ? `- **Sobre o comprador**: ${company.company_description}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const paramsBlock = `## Parâmetros da análise

- **Nome da análise**: ${params.analysisName}
${params.analysisPeriod ? `- **Período**: ${params.analysisPeriod}` : ''}
- **Itens enviados**: ${params.items.length} (consolidação: ${params.consolidate ? 'sim' : 'não'})
${params.notes ? `- **Notas do comprador**: ${params.notes}` : ''}${
    companyBlock
      ? `\n\n## Empresa do comprador\n\n${companyBlock}`
      : ''
  }`;

  const classificationBlock = `## Classificação determinística (NÃO recalcular)

<abc-classification>
${formatClassificationBlock(analysis)}
</abc-classification>`;

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

Gere a análise ABC completa agora. Comece pelo título seguido do Sumário Executivo nos 3 blocos descritos no system prompt. Depois plano por classe (A/B/C/cauda longa), com os itens-chave citados por nome. Produza markdown limpo.`;

  return {
    system: ABC_SYSTEM_PROMPT,
    user: [
      paramsBlock,
      classificationBlock,
      templateBlock,
      contextBlock,
      instruction,
    ].join('\n\n---\n\n'),
  };
}
