import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { withUser } from '@/lib/observability/user-context';
import type { RetrievedChunk } from '@/lib/rag/types';
import type { CompanyData } from '@/lib/db/user-company';
import type { SpendAnalysisParams } from '@/lib/assistants/types';
import type { SpendCube, SpendInvoiceRow } from './types';

// Narrativa de strategic sourcing (playbook §7). O LLM recebe o spend cube
// (números determinísticos) + uma amostra das invoices + trechos da base e
// produz APENAS as recomendações priorizadas — os KPIs/tabelas já são
// renderizados deterministicamente no relatório (lib/spend/summary.ts).

const TIMEOUT_MS = 60_000;
const MAX_OUTPUT_TOKENS = 1800;

export const SPEND_NARRATIVE_SYSTEM_PROMPT = `Você é um especialista sênior em strategic sourcing analisando a carteira de gastos (spend) de uma empresa, a partir de invoices já extraídas e classificadas.

Sua tarefa: produzir a seção **Recomendações de Strategic Sourcing** em português, em Markdown. Os KPIs e tabelas já estão no relatório — NÃO os repita; foque no diagnóstico e nas ações.

## Regras
1. Use SOMENTE os números do bloco <spend-cube>. NÃO invente valores, fornecedores ou percentuais que não estejam ali.
2. Identifique padrões nos dados e mapeie cada um a uma alavanca de sourcing. Use este framework (sinal → diagnóstico → alavanca):
   - Muitas transações de baixo valor, mesmo fornecedor → tail/maverick spend → catálogo, P-card, consolidação de pedidos.
   - Gasto recorrente previsível → contrato de volume/forward, preço travado.
   - Serviço por hora, alto valor, sem PO → off-contract/scope creep → MSA + SOW, teto de horas.
   - Mesmo fornecedor em várias frentes → fragmentação → MSA guarda-chuva, gestão única.
   - Pagamentos sem PO → risco de controle → "No-PO, no-pay".
   - Gasto em várias moedas → exposição cambial → monitorar/hedge.
3. Gere de 3 a 6 **ações priorizadas**, cada uma com prioridade (Alta/Média/Baixa) e, em uma linha cada: **Diagnóstico** (baseado nos dados), **Alavanca** (ação concreta), **Impacto esperado**, **Drill-down** (quais fornecedores/categorias/notas sustentam — cite nomes do <spend-cube> ou da amostra).
4. Priorize por valor endereçável × recorrência. Comece pelas de alto valor.
5. Profundidade sênior, direto ao ponto. Sem preâmbulo. Comece com "## Recomendações de Strategic Sourcing".`;

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

export function buildSpendNarrativePrompt(args: {
  cube: SpendCube;
  topInvoices: SpendInvoiceRow[];
  params: SpendAnalysisParams;
  chunks: RetrievedChunk[];
  company: CompanyData | null;
}): { system: string; user: string } {
  const { cube, topInvoices, params, chunks, company } = args;
  const ref = cube.referenceCurrency;

  const cubeBlock = [
    `Moeda de referência: ${ref}`,
    `Gasto total: ${ref} ${fmt(cube.totalRef)} em ${cube.invoiceCount} notas, ${cube.bySupplier.length} fornecedores.`,
    `Cobertura de PO: ${(cube.poCoveragePct * 100).toFixed(0)}% das notas, ${(cube.poSpendPct * 100).toFixed(0)}% do gasto.`,
    `Ticket médio: ${ref} ${fmt(cube.ticketMedio)}.`,
    `Tail spend: ${ref} ${fmt(cube.tailSpend.tailSpendRef)} em ${cube.tailSpend.suppliersBeyond80Pct} fornecedores na cauda.`,
    '',
    'Top categorias: ' +
      cube.byCategory
        .slice(0, 8)
        .map((c) => `${c.key} (${ref} ${fmt(c.totalRef)}, ${(c.pct * 100).toFixed(0)}%, ${c.count} notas)`)
        .join('; '),
    'Top fornecedores: ' +
      cube.bySupplier
        .slice(0, 10)
        .map((s) => `${s.key} (${ref} ${fmt(s.totalRef)}, ${(s.pct * 100).toFixed(0)}%, ${s.count} notas)`)
        .join('; '),
    cube.byCountry.length > 1
      ? 'Por país: ' + cube.byCountry.map((c) => `${c.key} (${ref} ${fmt(c.totalRef)})`).join('; ')
      : '',
    cube.semCambio.length > 0
      ? 'Moedas sem conversão: ' + cube.semCambio.map((s) => `${s.currency} (${s.count} notas)`).join('; ')
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const sampleBlock =
    topInvoices.length === 0
      ? '(sem amostra)'
      : topInvoices
          .slice(0, 15)
          .map(
            (r) =>
              `- ${r.supplier ?? 's/ fornecedor'} · ${r.category ?? 's/ cat'} · ${r.currency ?? ''} ${r.total ?? '?'} · PO: ${r.po_number ?? 'Sem PO'} · ${r.payment_terms ?? 's/ prazo'}`,
          )
          .join('\n');

  const baseBlock =
    chunks.length === 0
      ? '(nenhum trecho relevante — use princípios gerais de strategic sourcing)'
      : chunks.map((c) => `### ${c.articleTitle}\n\n${c.content.slice(0, 700)}`).join('\n\n---\n\n');

  const companyBlock = company?.company_name ? `Comprador: ${company.company_name}.` : '';

  const user = `## Contexto
Análise: ${params.analysisName}${params.period ? ` · Período: ${params.period}` : ''}. ${companyBlock}
${params.notes ? `Notas do comprador: ${params.notes}` : ''}

## Dados agregados (use SOMENTE estes números)
<spend-cube>
${cubeBlock}
</spend-cube>

## Amostra de notas (para drill-down)
<amostra-invoices>
${sampleBlock}
</amostra-invoices>

## Base de conhecimento (fundamente, não cite IDs)
<base>
${baseBlock}
</base>

## Tarefa
Gere agora a seção "## Recomendações de Strategic Sourcing" com 3-6 ações priorizadas, cada uma com Diagnóstico / Alavanca / Impacto / Drill-down.`;

  return { system: SPEND_NARRATIVE_SYSTEM_PROMPT, user };
}

/** Chama o LLM (tier generation) e retorna o markdown das recomendações.
 *  Fail-soft: retorna '' em qualquer erro (o pipeline usa só o resumo). */
export async function generateSpendNarrative(
  prompt: { system: string; user: string },
  userId: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await withUser(userId, async () => {
      const ai = getOpenAI();
      const model = getOpenAIModel('generation');
      const res = await ai.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          temperature: 0.3,
          max_completion_tokens: MAX_OUTPUT_TOKENS,
        },
        { signal: controller.signal },
      );
      void recordApiUsage({
        provider: 'openai',
        operation: 'assistant-spend-generate',
        model,
        tokensIn: res.usage?.prompt_tokens ?? 0,
        tokensOut: res.usage?.completion_tokens ?? 0,
        tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      });
      return res.choices[0]?.message?.content?.trim() ?? '';
    });
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}
