import { describe, expect, it } from 'vitest';
import { renderQuickChartPng } from '@/lib/charts/quick-chart-render';
import type { QuickChartSeries, QuickChartSpec } from '@/lib/charts/types';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function series(): QuickChartSeries {
  return { labels: ['ACME', 'Globex', 'Initech'], values: [120000, 80500, -5000] };
}

function spec(over: Partial<QuickChartSpec> = {}): QuickChartSpec {
  return {
    chartType: 'bar',
    categoryColumn: 'Fornecedor',
    valueColumn: 'Gasto',
    title: 'Gasto por fornecedor',
    ...over,
  };
}

describe('renderQuickChartPng', () => {
  it('renders a valid PNG for a bar chart, including negative values', async () => {
    const buf = await renderQuickChartPng(series(), spec());
    expect(buf.subarray(0, 8)).toEqual(PNG_MAGIC);
  });

  it('renders a valid PNG for a line chart', async () => {
    const buf = await renderQuickChartPng(series(), spec({ chartType: 'line' }));
    expect(buf.subarray(0, 8)).toEqual(PNG_MAGIC);
  });

  it('renders a valid PNG for a pie chart', async () => {
    const positive: QuickChartSeries = { labels: ['A', 'B', 'C'], values: [50, 30, 20] };
    const buf = await renderQuickChartPng(positive, spec({ chartType: 'pie' }));
    expect(buf.subarray(0, 8)).toEqual(PNG_MAGIC);
  });

  it('does not throw on a single-category series', async () => {
    const one: QuickChartSeries = { labels: ['Só isso'], values: [42] };
    const buf = await renderQuickChartPng(one, spec());
    expect(buf.length).toBeGreaterThan(0);
  });
});
