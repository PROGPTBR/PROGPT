import { coerceAmount } from '@/lib/spend/sheet-import';
import type { QuickChartSeries, QuickChartSpec, QuickChartTable } from './types';

// "Gráfico Rápido" — extrai {labels, values} da tabela crua usando o spec
// (categoryColumn/valueColumn/chartType) já decidido por quick-chart-infer.
// Agrega duplicatas de categoria por soma (comportamento esperado pra dado
// de procurement: "gasto por fornecedor" com várias linhas por fornecedor).

const MAX_CATEGORIES_BAR_PIE = 20;
const MAX_POINTS_LINE = 60;

export function buildQuickChartSeries(
  table: QuickChartTable,
  spec: QuickChartSpec,
): { series: QuickChartSeries; warnings: string[] } {
  const warnings: string[] = [];
  const catIdx = table.headers.indexOf(spec.categoryColumn);
  const valIdx = table.headers.indexOf(spec.valueColumn);
  if (catIdx === -1 || valIdx === -1) {
    return {
      series: { labels: [], values: [] },
      warnings: ['Colunas de categoria/valor não encontradas na tabela.'],
    };
  }

  const totals = new Map<string, number>();
  const order: string[] = [];
  for (const row of table.rows) {
    const rawLabel = row[catIdx];
    const label =
      rawLabel === null || rawLabel === undefined || String(rawLabel).trim() === ''
        ? null
        : String(rawLabel).trim();
    const value = coerceAmount(row[valIdx]);
    if (label === null || value === null) continue;
    if (!totals.has(label)) {
      totals.set(label, 0);
      order.push(label);
    }
    totals.set(label, totals.get(label)! + value);
  }

  if (totals.size === 0) {
    return {
      series: { labels: [], values: [] },
      warnings: ['Nenhuma linha com categoria + valor numérico válidos.'],
    };
  }

  let labels: string[];
  let values: number[];

  if (spec.chartType === 'line') {
    // Preserva a ordem original das linhas (assume sequência — ex.: meses).
    labels = order;
    values = order.map((l) => totals.get(l)!);
    if (labels.length > MAX_POINTS_LINE) {
      warnings.push(`Mostrando os primeiros ${MAX_POINTS_LINE} pontos de ${labels.length}.`);
      labels = labels.slice(0, MAX_POINTS_LINE);
      values = values.slice(0, MAX_POINTS_LINE);
    }
  } else {
    let entries = [...totals.entries()];
    if (spec.chartType === 'pie') {
      const before = entries.length;
      entries = entries.filter(([, v]) => v > 0);
      if (entries.length < before) {
        warnings.push('Categorias com valor zero ou negativo foram removidas do gráfico de pizza.');
      }
    }
    entries.sort((a, b) => b[1] - a[1]);

    if (entries.length > MAX_CATEGORIES_BAR_PIE) {
      const head = entries.slice(0, MAX_CATEGORIES_BAR_PIE - 1);
      const restSum = entries.slice(MAX_CATEGORIES_BAR_PIE - 1).reduce((s, [, v]) => s + v, 0);
      head.push([`Outros (${entries.length - (MAX_CATEGORIES_BAR_PIE - 1)})`, restSum]);
      warnings.push(
        `${entries.length} categorias agrupadas em ${MAX_CATEGORIES_BAR_PIE} (o restante virou "Outros").`,
      );
      entries = head;
    }
    labels = entries.map(([l]) => l);
    values = entries.map(([, v]) => v);
  }

  return { series: { labels, values }, warnings };
}
