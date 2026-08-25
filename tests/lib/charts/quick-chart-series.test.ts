import { describe, expect, it } from 'vitest';
import { buildQuickChartSeries } from '@/lib/charts/quick-chart-series';
import type { QuickChartSpec, QuickChartTable } from '@/lib/charts/types';

function spec(over: Partial<QuickChartSpec> = {}): QuickChartSpec {
  return {
    chartType: 'bar',
    categoryColumn: 'Fornecedor',
    valueColumn: 'Gasto',
    title: 'Teste',
    ...over,
  };
}

describe('buildQuickChartSeries', () => {
  it('sums duplicate categories', () => {
    const table: QuickChartTable = {
      headers: ['Fornecedor', 'Gasto'],
      rows: [
        ['ACME', 100],
        ['Globex', 50],
        ['ACME', 20],
      ],
    };
    const { series, warnings } = buildQuickChartSeries(table, spec());
    expect(warnings).toEqual([]);
    const acmeIdx = series.labels.indexOf('ACME');
    expect(series.values[acmeIdx]).toBe(120);
  });

  it('sorts bar/pie categories descending by value', () => {
    const table: QuickChartTable = {
      headers: ['Cat', 'Val'],
      rows: [
        ['A', 10],
        ['B', 50],
        ['C', 30],
      ],
    };
    const { series } = buildQuickChartSeries(table, spec({ categoryColumn: 'Cat', valueColumn: 'Val' }));
    expect(series.labels).toEqual(['B', 'C', 'A']);
    expect(series.values).toEqual([50, 30, 10]);
  });

  it('preserves row order for line charts (assumes sequence, e.g. months)', () => {
    const table: QuickChartTable = {
      headers: ['Mes', 'Valor'],
      rows: [
        ['Jan', 10],
        ['Mar', 5],
        ['Fev', 30],
      ],
    };
    const { series } = buildQuickChartSeries(
      table,
      spec({ chartType: 'line', categoryColumn: 'Mes', valueColumn: 'Valor' }),
    );
    expect(series.labels).toEqual(['Jan', 'Mar', 'Fev']);
    expect(series.values).toEqual([10, 5, 30]);
  });

  it('drops rows with missing category or non-numeric value', () => {
    const table: QuickChartTable = {
      headers: ['Cat', 'Val'],
      rows: [
        ['A', 10],
        [null, 20],
        ['B', 'não é número'],
      ],
    };
    const { series } = buildQuickChartSeries(table, spec({ categoryColumn: 'Cat', valueColumn: 'Val' }));
    expect(series.labels).toEqual(['A']);
    expect(series.values).toEqual([10]);
  });

  it('groups categories beyond the cap into "Outros" for bar/pie', () => {
    const rows = Array.from({ length: 25 }, (_, i) => [`Cat${i}`, 25 - i]);
    const table: QuickChartTable = { headers: ['Cat', 'Val'], rows };
    const { series, warnings } = buildQuickChartSeries(table, spec({ categoryColumn: 'Cat', valueColumn: 'Val' }));
    expect(series.labels.length).toBe(20);
    expect(series.labels.at(-1)).toMatch(/^Outros/);
    expect(warnings.some((w) => w.includes('agrupadas'))).toBe(true);
  });

  it('filters non-positive values out of pie charts with a warning', () => {
    const table: QuickChartTable = {
      headers: ['Cat', 'Val'],
      rows: [
        ['A', 10],
        ['B', -5],
        ['C', 0],
      ],
    };
    const { series, warnings } = buildQuickChartSeries(
      table,
      spec({ chartType: 'pie', categoryColumn: 'Cat', valueColumn: 'Val' }),
    );
    expect(series.labels).toEqual(['A']);
    expect(warnings.some((w) => w.includes('zero ou negativo'))).toBe(true);
  });

  it('returns a warning and empty series when the spec columns do not exist', () => {
    const table: QuickChartTable = { headers: ['A', 'B'], rows: [['x', 1]] };
    const { series, warnings } = buildQuickChartSeries(table, spec({ categoryColumn: 'Nope', valueColumn: 'B' }));
    expect(series.labels).toEqual([]);
    expect(warnings[0]).toMatch(/não encontradas/);
  });
});
