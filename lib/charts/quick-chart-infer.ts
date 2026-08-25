import { z } from 'zod';
import { getOpenAI, getOpenAIModel, withRateLimitRetry } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { coerceAmount } from '@/lib/spend/sheet-import';
import type { QuickChartKind, QuickChartSpec, QuickChartTable } from './types';

// "Gráfico Rápido" — decide qual coluna é a categoria (eixo) e qual é o
// valor numérico, e sugere o tipo de gráfico. Tier `routing` (gpt-4o-mini):
// classificação JSON curta, alto volume, custo desprezível — mesmo
// call-site pattern de lib/ingest/classify-content.ts. Fail-soft: qualquer
// erro (timeout, JSON inválido, coluna inexistente) cai na heurística
// determinística abaixo, nunca quebra o pedido do usuário.

const TIMEOUT_MS = 12_000;
const SAMPLE_ROWS = 12;

const VALUE_HINT_RE =
  /valor|total|gasto|amount|value|montante|pre[çc]o|price|quantidade|\bqtd\b|\bqty\b|score|percentual|\bspend\b|receita|custo|cost/i;

const InferSchema = z.object({
  categoryColumn: z.string(),
  valueColumn: z.string(),
  chartType: z.enum(['bar', 'line', 'pie']),
  title: z.string(),
});

function numericRatioByColumn(table: QuickChartTable): number[] {
  return table.headers.map((_, colIdx) => {
    const vals = table.rows.map((r) => r[colIdx]);
    if (vals.length === 0) return 0;
    const numeric = vals.filter((v) => coerceAmount(v) !== null).length;
    return numeric / vals.length;
  });
}

function heuristicSpec(table: QuickChartTable): QuickChartSpec {
  const { headers } = table;
  const ratios = numericRatioByColumn(table);

  let valueIdx = headers.findIndex((h, i) => VALUE_HINT_RE.test(h) && ratios[i]! >= 0.5);
  if (valueIdx === -1) valueIdx = ratios.findIndex((r) => r >= 0.6);
  if (valueIdx === -1) valueIdx = headers.length - 1;

  let categoryIdx = headers.findIndex((_, i) => i !== valueIdx && ratios[i]! < 0.6);
  if (categoryIdx === -1) categoryIdx = headers.findIndex((_, i) => i !== valueIdx);
  if (categoryIdx === -1) categoryIdx = 0;

  return {
    chartType: 'bar',
    categoryColumn: headers[categoryIdx] ?? headers[0] ?? 'Categoria',
    valueColumn: headers[valueIdx] ?? headers[headers.length - 1] ?? 'Valor',
    title: 'Gráfico',
  };
}

export async function inferQuickChartSpec(
  table: QuickChartTable,
  overrideChartType?: QuickChartKind,
  titleHint?: string,
): Promise<QuickChartSpec> {
  const fallback = heuristicSpec(table);
  if (overrideChartType) fallback.chartType = overrideChartType;
  if (titleHint) fallback.title = titleHint;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const ai = getOpenAI();
    const res = await withRateLimitRetry(
      () =>
        ai.chat.completions.create(
          {
            model: getOpenAIModel(),
            messages: [
              {
                role: 'system',
                content:
                  'Você identifica, numa tabela de dados de procurement, qual coluna é a CATEGORIA (eixo/rótulo) e qual é o VALOR numérico a plotar, e sugere o tipo de gráfico mais adequado. Use "line" SOMENTE quando a categoria for claramente uma sequência temporal (datas/meses/anos em ordem). Use "pie" SOMENTE quando houver poucas categorias (até ~8) representando partes de um todo. Caso contrário, use "bar". Sugira também um título curto (até 60 caracteres) em português. Responda em JSON: {"categoryColumn": string, "valueColumn": string, "chartType": "bar"|"line"|"pie", "title": string}. categoryColumn e valueColumn DEVEM ser exatamente um dos headers fornecidos.',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  headers: table.headers,
                  sample: table.rows.slice(0, SAMPLE_ROWS),
                }),
              },
            ],
            response_format: { type: 'json_object' },
            max_completion_tokens: 200,
          },
          { signal: controller.signal },
        ),
      controller.signal,
      'charts/quick-chart-infer',
    );

    const raw = res.choices[0]?.message?.content ?? '';
    void recordApiUsage({
      provider: 'openai',
      operation: 'quick-chart-infer',
      model: getOpenAIModel(),
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    });

    const parsed = InferSchema.parse(JSON.parse(raw));
    if (!table.headers.includes(parsed.categoryColumn) || !table.headers.includes(parsed.valueColumn)) {
      return fallback;
    }
    return {
      chartType: overrideChartType ?? parsed.chartType,
      categoryColumn: parsed.categoryColumn,
      valueColumn: parsed.valueColumn,
      title: titleHint || parsed.title || fallback.title,
    };
  } catch (err) {
    console.warn('[quick-chart] infer fallback:', err instanceof Error ? err.message : err);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
