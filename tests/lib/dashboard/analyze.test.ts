import { describe, it, expect } from 'vitest';
import {
  coerceNumber, coerceDate, profileColumns, planDashboard,
  groupBy, topN, timeSeries, crosstab, autoKpis, buildDataset,
  looksLikeMoney, looksLikePercent, keyOf, scatterPairs,
  type Row,
} from '@/lib/dashboard/analyze';
import { parseCsv, recordsToRows } from '@/lib/dashboard/parse-file';
import { sampleDataset } from '@/lib/dashboard/sample';

describe('coerceNumber', () => {
  it('parses pt-BR currency and thousands', () => {
    expect(coerceNumber('R$ 1.234,56')).toBeCloseTo(1234.56);
    expect(coerceNumber('1.000')).toBe(1000);
    expect(coerceNumber('2.500,00')).toBe(2500);
  });
  it('parses en-US format', () => {
    expect(coerceNumber('1,234.56')).toBeCloseTo(1234.56);
    expect(coerceNumber('$2,000')).toBe(2000);
  });
  it('parses percent as fraction', () => {
    expect(coerceNumber('12,5%')).toBeCloseTo(0.125);
  });
  it('passes through numbers and rejects junk', () => {
    expect(coerceNumber(42)).toBe(42);
    expect(coerceNumber('abc')).toBeNull();
    expect(coerceNumber('')).toBeNull();
    expect(coerceNumber(null)).toBeNull();
  });
});

describe('coerceDate', () => {
  it('parses ISO and pt-BR dates', () => {
    expect(coerceDate('2026-06-30')).toBe('2026-06-30');
    expect(coerceDate('30/06/2026')).toBe('2026-06-30');
    expect(coerceDate('2026-06')).toBe('2026-06-01');
  });
  it('rejects non-dates', () => {
    expect(coerceDate('hello')).toBeNull();
    expect(coerceDate('42')).toBeNull();
  });
});

describe('profileColumns', () => {
  const rows: Row[] = [
    { data: '2026-01-05', cat: 'A', valor: 'R$ 100,00' },
    { data: '2026-02-10', cat: 'B', valor: 'R$ 200,00' },
    { data: '2026-02-20', cat: 'A', valor: 'R$ 300,00' },
  ];
  it('detects number, date and category types', () => {
    const cols = profileColumns(rows);
    const byName = Object.fromEntries(cols.map((c) => [c.name, c]));
    expect(byName.valor!.type).toBe('number');
    expect(byName.valor!.sum).toBe(600);
    expect(byName.data!.type).toBe('date');
    expect(byName.cat!.type).toBe('category');
    expect(byName.cat!.distinct).toBe(2);
  });
  it('returns [] for empty input', () => {
    expect(profileColumns([])).toEqual([]);
  });
});

describe('groupBy + topN', () => {
  const rows: Row[] = [
    { cat: 'A', v: 10 }, { cat: 'B', v: 5 }, { cat: 'A', v: 20 }, { cat: 'C', v: 1 },
  ];
  it('sums by dimension sorted desc', () => {
    const g = groupBy(rows, 'cat', 'v');
    expect(g[0]).toEqual({ key: 'A', value: 30, count: 2 });
    expect(g.map((s) => s.key)).toEqual(['A', 'B', 'C']);
  });
  it('counts when measure is null', () => {
    const g = groupBy(rows, 'cat', null, 'count');
    expect(g.find((s) => s.key === 'A')!.value).toBe(2);
  });
  it('collapses tail into Outros', () => {
    const g = topN(groupBy(rows, 'cat', 'v'), 1);
    expect(g).toHaveLength(2);
    expect(g[1]!.key).toBe('Outros');
    expect(g[1]!.value).toBe(6);
  });
});

describe('timeSeries', () => {
  it('aggregates by month sorted asc', () => {
    const rows: Row[] = [
      { d: '2026-01-05', v: 10 },
      { d: '2026-01-20', v: 5 },
      { d: '2026-03-01', v: 7 },
    ];
    const ts = timeSeries(rows, 'd', 'v');
    expect(ts).toEqual([
      { key: '2026-01', value: 15, count: 2 },
      { key: '2026-03', value: 7, count: 1 },
    ]);
  });
});

describe('crosstab', () => {
  it('builds matrix and stacked rows', () => {
    const rows: Row[] = [
      { a: 'X', b: 'P', v: 1 },
      { a: 'X', b: 'Q', v: 2 },
      { a: 'Y', b: 'P', v: 4 },
    ];
    const ct = crosstab(rows, 'a', 'b', 'v');
    expect(ct.rowKeys).toContain('X');
    expect(ct.matrix['X']!['Q']).toBe(2);
    expect(ct.matrix['Y']!['P']).toBe(4);
    const xRow = ct.stacked.find((s) => s.dim === 'X')!;
    expect(xRow['P']).toBe(1);
  });
});

describe('planDashboard + autoKpis', () => {
  it('picks primary measure by largest sum and a categorical dim', () => {
    const ds = buildDataset([
      { regiao: 'SE', valor: 100, itens: 2, data: '2026-01-01' },
      { regiao: 'S', valor: 300, itens: 1, data: '2026-02-01' },
    ]);
    const plan = planDashboard(ds.columns);
    expect(plan.primaryMeasure).toBe('valor');
    expect(plan.primaryDimension).toBe('regiao');
    expect(plan.dateColumn).toBe('data');
    const kpis = autoKpis(ds, plan);
    expect(kpis[0]).toEqual({ label: 'Registros', value: 2, format: 'number' });
    expect(kpis.some((k) => k.label.includes('valor') && k.format === 'currency')).toBe(true);
  });
});

describe('format heuristics', () => {
  it('detects money and percent column names', () => {
    expect(looksLikeMoney('Valor (R$)')).toBe(true);
    expect(looksLikeMoney('Economia')).toBe(true);
    expect(looksLikePercent('Margem %')).toBe(true);
    expect(looksLikeMoney('Região')).toBe(false);
  });
});

describe('keyOf + scatterPairs', () => {
  it('normalizes empty keys', () => {
    expect(keyOf(null)).toBe('(vazio)');
    expect(keyOf('  x ')).toBe('x');
  });
  it('pairs two measures skipping non-numeric', () => {
    const rows: Row[] = [{ x: 1, y: 2, l: 'a' }, { x: 'z', y: 3, l: 'b' }];
    const pairs = scatterPairs(rows, 'x', 'y', 'l');
    expect(pairs).toEqual([{ x: 1, y: 2, label: 'a' }]);
  });
});

describe('parseCsv', () => {
  it('parses headers, quotes and semicolon delimiter', () => {
    const csv = 'nome;valor\n"Silva, A";1.000\nBeta;2.000';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ nome: 'Silva, A', valor: '1.000' });
  });
  it('dedupes duplicate headers', () => {
    const rows = recordsToRows([['a', 'a'], ['1', '2']]);
    expect(Object.keys(rows[0]!)).toEqual(['a', 'a (2)']);
  });
});

describe('sampleDataset', () => {
  it('is deterministic and rich enough for all charts', () => {
    const a = sampleDataset();
    const b = sampleDataset();
    expect(a.rows.length).toBe(b.rows.length);
    expect(a.rows[0]).toEqual(b.rows[0]);
    const plan = planDashboard(buildDataset(a.rows).columns);
    expect(plan.primaryMeasure).toBeTruthy();
    expect(plan.primaryDimension).toBeTruthy();
    expect(plan.secondaryDimension).toBeTruthy();
    expect(plan.dateColumn).toBeTruthy();
    expect(plan.measures.length).toBeGreaterThanOrEqual(2);
  });
});
