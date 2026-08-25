import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { QuickChartTable } from '@/lib/charts/types';

beforeEach(() => {
  vi.resetModules();
});

function setupOpenAIMock(opts: { content?: string; throws?: Error } = {}) {
  const create = vi.fn().mockImplementation(async () => {
    if (opts.throws) throw opts.throws;
    return {
      choices: [{ message: { content: opts.content ?? '' } }],
      usage: { prompt_tokens: 50, completion_tokens: 20 },
    };
  });
  vi.doMock('@/lib/llm/openai', () => ({
    getOpenAI: () => ({ chat: { completions: { create } } }),
    getOpenAIModel: () => 'gpt-4o-mini',
    withRateLimitRetry: <T>(fn: () => Promise<T>) => fn(),
  }));
  return { create };
}

const TABLE: QuickChartTable = {
  headers: ['Fornecedor', 'Gasto'],
  rows: [
    ['ACME', 120000],
    ['Globex', 80500],
  ],
};

describe('inferQuickChartSpec', () => {
  it('uses the LLM-suggested mapping when it references real headers', async () => {
    setupOpenAIMock({
      content: JSON.stringify({
        categoryColumn: 'Fornecedor',
        valueColumn: 'Gasto',
        chartType: 'bar',
        title: 'Gasto por fornecedor',
      }),
    });
    const { inferQuickChartSpec } = await import('@/lib/charts/quick-chart-infer');
    const spec = await inferQuickChartSpec(TABLE);
    expect(spec).toEqual({
      chartType: 'bar',
      categoryColumn: 'Fornecedor',
      valueColumn: 'Gasto',
      title: 'Gasto por fornecedor',
    });
  });

  it('an explicit chartType override wins over the LLM suggestion', async () => {
    setupOpenAIMock({
      content: JSON.stringify({
        categoryColumn: 'Fornecedor',
        valueColumn: 'Gasto',
        chartType: 'bar',
        title: 'Gasto por fornecedor',
      }),
    });
    const { inferQuickChartSpec } = await import('@/lib/charts/quick-chart-infer');
    const spec = await inferQuickChartSpec(TABLE, 'pie');
    expect(spec.chartType).toBe('pie');
  });

  it('falls back to the deterministic heuristic when the OpenAI call throws', async () => {
    setupOpenAIMock({ throws: new Error('network down') });
    const { inferQuickChartSpec } = await import('@/lib/charts/quick-chart-infer');
    const spec = await inferQuickChartSpec(TABLE);
    expect(spec.categoryColumn).toBe('Fornecedor');
    expect(spec.valueColumn).toBe('Gasto');
    expect(spec.chartType).toBe('bar');
  });

  it('falls back to the heuristic when the LLM returns a column that does not exist', async () => {
    setupOpenAIMock({
      content: JSON.stringify({
        categoryColumn: 'Coluna Inventada',
        valueColumn: 'Gasto',
        chartType: 'line',
        title: 'x',
      }),
    });
    const { inferQuickChartSpec } = await import('@/lib/charts/quick-chart-infer');
    const spec = await inferQuickChartSpec(TABLE);
    expect(spec.categoryColumn).toBe('Fornecedor');
    expect(spec.valueColumn).toBe('Gasto');
  });

  it('falls back to the heuristic on malformed JSON', async () => {
    setupOpenAIMock({ content: 'não é json' });
    const { inferQuickChartSpec } = await import('@/lib/charts/quick-chart-infer');
    const spec = await inferQuickChartSpec(TABLE);
    expect(spec.valueColumn).toBe('Gasto');
  });

  it('heuristic prefers a header matching value-like keywords when numeric', async () => {
    setupOpenAIMock({ throws: new Error('down') });
    const { inferQuickChartSpec } = await import('@/lib/charts/quick-chart-infer');
    const table: QuickChartTable = {
      headers: ['Código', 'Categoria', 'Valor Total'],
      rows: [
        ['1', 'TI', 1000],
        ['2', 'Facilities', 500],
      ],
    };
    const spec = await inferQuickChartSpec(table);
    expect(spec.valueColumn).toBe('Valor Total');
    expect(spec.categoryColumn).not.toBe('Valor Total');
  });

  it('a title hint overrides both the LLM title and the heuristic title', async () => {
    setupOpenAIMock({
      content: JSON.stringify({
        categoryColumn: 'Fornecedor',
        valueColumn: 'Gasto',
        chartType: 'bar',
        title: 'Título da IA',
      }),
    });
    const { inferQuickChartSpec } = await import('@/lib/charts/quick-chart-infer');
    const spec = await inferQuickChartSpec(TABLE, undefined, 'Meu título');
    expect(spec.title).toBe('Meu título');
  });
});
