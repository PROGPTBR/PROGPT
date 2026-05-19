import { describe, expect, it } from 'vitest';
import {
  classifyAbc,
  consolidateItems,
  buildAbcPrompt,
  ABC_SYSTEM_PROMPT,
} from '@/lib/assistants/abc';
import type { AbcItem, AbcParams, TemplateRow } from '@/lib/assistants/types';

function mkItem(name: string, spend: number, extra: Partial<AbcItem> = {}): AbcItem {
  return {
    name,
    spend,
    supplier: '',
    category: '',
    unit: '',
    ...extra,
  };
}

const TEMPLATE: TemplateRow = {
  id: 't1',
  assistant_type: 'abc',
  name: 'Template padrão',
  description: 'Default',
  body_md: '# Template\n\n{{analysisName}}',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: null,
};

describe('consolidateItems', () => {
  it('sums spend by name (case-insensitive)', () => {
    const out = consolidateItems([
      mkItem('Parafuso M8', 100, { quantity: 10 }),
      mkItem('parafuso m8', 50, { quantity: 5 }),
      mkItem('Porca M8', 30),
    ]);
    expect(out).toHaveLength(2);
    const parafuso = out.find((i) => i.name.toLowerCase() === 'parafuso m8');
    expect(parafuso?.spend).toBe(150);
    expect(parafuso?.quantity).toBe(15);
  });

  it('keeps unique items untouched when no duplicates', () => {
    const out = consolidateItems([
      mkItem('A', 100),
      mkItem('B', 50),
      mkItem('C', 25),
    ]);
    expect(out).toHaveLength(3);
  });
});

describe('classifyAbc', () => {
  const baseParams = (items: AbcItem[]): AbcParams => ({
    analysisName: 'Test',
    analysisPeriod: '',
    notes: '',
    consolidate: false,
    items,
  });

  it('classifies items by Pareto 80/95% cumulative thresholds', () => {
    // Construct a dataset where the cumulative crosses 80% and 95%
    // at known points.
    // Spends: 70, 15, 10, 3, 2 → total 100
    // Cumulative: 70%, 85%, 95%, 98%, 100%
    // Expected classes:
    //   item 1 (70% cum) → A (70 <= 80)
    //   item 2 (85% cum) → B (85 <= 95)
    //   item 3 (95% cum) → B (95 <= 95)
    //   item 4 (98% cum) → C
    //   item 5 (100% cum) → C
    const params = baseParams([
      mkItem('A1', 70),
      mkItem('B1', 15),
      mkItem('B2', 10),
      mkItem('C1', 3),
      mkItem('C2', 2),
    ]);
    const out = classifyAbc(params);
    expect(out.totalSpend).toBe(100);
    expect(out.totalItems).toBe(5);
    expect(out.items[0]?.abcClass).toBe('A');
    expect(out.items[1]?.abcClass).toBe('B');
    expect(out.items[2]?.abcClass).toBe('B');
    expect(out.items[3]?.abcClass).toBe('C');
    expect(out.items[4]?.abcClass).toBe('C');
  });

  it('sorts items by spend descending and assigns ranks 1..n', () => {
    const out = classifyAbc(
      baseParams([
        mkItem('Small', 5),
        mkItem('Big', 100),
        mkItem('Mid', 30),
      ]),
    );
    expect(out.items[0]?.name).toBe('Big');
    expect(out.items[0]?.rank).toBe(1);
    expect(out.items[1]?.name).toBe('Mid');
    expect(out.items[2]?.name).toBe('Small');
  });

  it('computes correct shares and cumulative shares', () => {
    const out = classifyAbc(
      baseParams([mkItem('A', 80), mkItem('B', 20)]),
    );
    expect(out.items[0]?.share).toBeCloseTo(0.8, 5);
    expect(out.items[0]?.cumulativeShare).toBeCloseTo(0.8, 5);
    expect(out.items[1]?.share).toBeCloseTo(0.2, 5);
    expect(out.items[1]?.cumulativeShare).toBeCloseTo(1.0, 5);
  });

  it('aggregates byClass totals correctly', () => {
    const out = classifyAbc(
      baseParams([
        mkItem('A1', 70),
        mkItem('B1', 15),
        mkItem('B2', 10),
        mkItem('C1', 3),
        mkItem('C2', 2),
      ]),
    );
    expect(out.byClass.A.count).toBe(1);
    expect(out.byClass.A.totalSpend).toBe(70);
    expect(out.byClass.A.spendShare).toBeCloseTo(0.7, 5);
    expect(out.byClass.B.count).toBe(2);
    expect(out.byClass.B.totalSpend).toBe(25);
    expect(out.byClass.C.count).toBe(2);
    expect(out.byClass.C.totalSpend).toBe(5);
  });

  it('forces single-item analysis into class A', () => {
    const out = classifyAbc(baseParams([mkItem('Only', 100)]));
    expect(out.items[0]?.abcClass).toBe('A');
    expect(out.byClass.A.count).toBe(1);
    expect(out.byClass.B.count).toBe(0);
    expect(out.byClass.C.count).toBe(0);
  });

  it('respects consolidate flag', () => {
    const items = [
      mkItem('X', 100),
      mkItem('X', 50),
      mkItem('Y', 30),
    ];
    const withConsolidate = classifyAbc({
      ...baseParams(items),
      consolidate: true,
    });
    expect(withConsolidate.totalItems).toBe(2);

    const withoutConsolidate = classifyAbc({
      ...baseParams(items),
      consolidate: false,
    });
    expect(withoutConsolidate.totalItems).toBe(3);
  });

  it('handles items with spend=0 without throwing', () => {
    const out = classifyAbc(
      baseParams([mkItem('A', 100), mkItem('B', 0)]),
    );
    expect(out.totalSpend).toBe(100);
    expect(out.items[1]?.share).toBe(0);
  });
});

describe('buildAbcPrompt', () => {
  it('embeds the deterministic classification block in the user message', () => {
    const params: AbcParams = {
      analysisName: 'Spend MRO 2026',
      analysisPeriod: '2026 Q1',
      notes: 'multiple suppliers per SKU',
      consolidate: true,
      items: [
        mkItem('Item Top', 800),
        mkItem('Item Mid', 150),
        mkItem('Item Tail', 50),
      ],
    };
    const analysis = classifyAbc(params);
    const { system, user } = buildAbcPrompt(params, TEMPLATE, [], analysis);
    expect(system).toBe(ABC_SYSTEM_PROMPT);
    expect(user).toMatch(/<abc-classification>/);
    expect(user).toMatch(/<\/abc-classification>/);
    expect(user).toMatch(/Spend MRO 2026/);
    expect(user).toMatch(/Item Top/);
    expect(user).toMatch(/Resumo por classe/);
  });

  it('mentions that no chunks were retrieved when chunks=[]', () => {
    const params: AbcParams = {
      analysisName: 'Test',
      analysisPeriod: '',
      notes: '',
      consolidate: true,
      items: [mkItem('A', 100), mkItem('B', 50), mkItem('C', 25)],
    };
    const analysis = classifyAbc(params);
    const { user } = buildAbcPrompt(params, TEMPLATE, [], analysis);
    expect(user).toMatch(/nenhum trecho relevante recuperado/);
  });
});

describe('ABC_SYSTEM_PROMPT', () => {
  it('mandates the 3-block executive summary structure', () => {
    expect(ABC_SYSTEM_PROMPT).toMatch(/Concentração de spend/);
    expect(ABC_SYSTEM_PROMPT).toMatch(/Diagnóstico/);
    expect(ABC_SYSTEM_PROMPT).toMatch(/Priorizar/);
  });

  it('explicitly forbids reclassification', () => {
    expect(ABC_SYSTEM_PROMPT).toMatch(/NÃO recalcule|NÃO reclassifique/);
  });

  it('refers to the Pareto thresholds 80/95%', () => {
    expect(ABC_SYSTEM_PROMPT).toMatch(/80%/);
    expect(ABC_SYSTEM_PROMPT).toMatch(/95%/);
  });
});
