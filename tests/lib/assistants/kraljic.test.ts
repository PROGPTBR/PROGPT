import { describe, expect, it } from 'vitest';
import {
  classifyItems,
  summarizeQuadrants,
  buildKraljicPrompt,
  KRALJIC_WEIGHTS,
  KRALJIC_SYSTEM_PROMPT,
} from '@/lib/assistants/kraljic';
import type { KraljicItem, TemplateRow } from '@/lib/assistants/types';

const baseItem: KraljicItem = {
  name: 'Item A',
  segment: '',
  category: '',
  spendMM: 10,
  criticality: 2,
  technicalSpec: 2,
  customerValue: 2,
  marketStructure: 2,
  marketRivalry: 2,
  supplierPower: 2,
  supplierSwitching: 2,
};

describe('classifyItems', () => {
  it('returns one ClassifiedKraljicItem per input', () => {
    const out = classifyItems([baseItem, { ...baseItem, name: 'B' }]);
    expect(out).toHaveLength(2);
    expect(out[0]!.name).toBe('Item A');
  });

  it('computes spendShare from total portfolio spend', () => {
    const out = classifyItems([
      { ...baseItem, spendMM: 75 },
      { ...baseItem, name: 'B', spendMM: 25 },
    ]);
    expect(out[0]!.spendShare).toBeCloseTo(0.75, 2);
    expect(out[1]!.spendShare).toBeCloseTo(0.25, 2);
  });

  it('derives spend score from quartile within portfolio', () => {
    const out = classifyItems([
      { ...baseItem, name: 'big', spendMM: 100 },
      { ...baseItem, name: 'mid-hi', spendMM: 30 },
      { ...baseItem, name: 'mid-lo', spendMM: 10 },
      { ...baseItem, name: 'small', spendMM: 1 },
    ]);
    const big = out.find((i) => i.name === 'big')!;
    const small = out.find((i) => i.name === 'small')!;
    expect(big.spendScore).toBeGreaterThanOrEqual(3);
    expect(small.spendScore).toBeLessThanOrEqual(2);
  });

  it('weighted business impact lands in [1, 4] for scale-1-4 inputs', () => {
    const out = classifyItems([baseItem]);
    expect(out[0]!.businessImpact).toBeGreaterThanOrEqual(1);
    expect(out[0]!.businessImpact).toBeLessThanOrEqual(4);
  });

  it('classifies high/high as Estratégico (matches PG template example R9)', () => {
    // R9 Matéria-Prima 1 from the Procurement Garage template: high spend
    // (60 of 500MM portfolio share), criticality=4, technicalSpec=1, customerValue=4
    // → impacto 3.55, complex 3.75, quadrant=Estratégico
    const items: KraljicItem[] = [
      { ...baseItem, name: 'MP1', spendMM: 60, criticality: 4, technicalSpec: 1, customerValue: 4,
        marketStructure: 3, marketRivalry: 4, supplierPower: 4, supplierSwitching: 4 },
      // Add some low-impact siblings so MP1 lands in top quartile of spend
      { ...baseItem, name: 'tiny1', spendMM: 0.5 },
      { ...baseItem, name: 'tiny2', spendMM: 0.5 },
      { ...baseItem, name: 'tiny3', spendMM: 0.5 },
    ];
    const out = classifyItems(items);
    const mp1 = out.find((i) => i.name === 'MP1')!;
    expect(mp1.quadrant).toBe('estrategico');
  });

  it('classifies high impact + low complex as Alavancável (PG example R12 Frete Inbound)', () => {
    // Spend high, scores: criticality=3 technicalSpec=2 customerValue=2 / market complexity all low
    const items: KraljicItem[] = [
      { ...baseItem, name: 'Frete', spendMM: 27, criticality: 3, technicalSpec: 2, customerValue: 2,
        marketStructure: 1, marketRivalry: 1, supplierPower: 3, supplierSwitching: 1 },
      { ...baseItem, name: 'small', spendMM: 0.5 },
    ];
    const out = classifyItems(items);
    expect(out.find((i) => i.name === 'Frete')!.quadrant).toBe('alavancavel');
  });

  it('classifies low impact + high complex as Gargalo (PG example R29 Assist Técnica)', () => {
    // Small spend + high complexity scores
    const items: KraljicItem[] = [
      { ...baseItem, name: 'AssistTec', spendMM: 0.75, criticality: 3, technicalSpec: 3, customerValue: 1,
        marketStructure: 3, marketRivalry: 3, supplierPower: 3, supplierSwitching: 3 },
      // dominate the portfolio with much bigger items so AssistTec spend score = 1
      { ...baseItem, name: 'huge1', spendMM: 100 },
      { ...baseItem, name: 'huge2', spendMM: 80 },
      { ...baseItem, name: 'huge3', spendMM: 60 },
    ];
    const out = classifyItems(items);
    expect(out.find((i) => i.name === 'AssistTec')!.quadrant).toBe('gargalo');
  });

  it('classifies low/low as Não Crítico', () => {
    const items: KraljicItem[] = [
      { ...baseItem, name: 'big', spendMM: 100 },
      { ...baseItem, name: 'NaoCrit', spendMM: 0.5, criticality: 1, technicalSpec: 1, customerValue: 1,
        marketStructure: 1, marketRivalry: 1, supplierPower: 1, supplierSwitching: 1 },
    ];
    const out = classifyItems(items);
    expect(out.find((i) => i.name === 'NaoCrit')!.quadrant).toBe('nao-critico');
  });

  it('handles total spend = 0 without divide-by-zero', () => {
    const items: KraljicItem[] = [
      { ...baseItem, name: 'A', spendMM: 0 },
      { ...baseItem, name: 'B', spendMM: 0 },
    ];
    const out = classifyItems(items);
    expect(out[0]!.spendShare).toBe(0);
    expect(out[0]!.businessImpact).toBeGreaterThanOrEqual(1);
  });

  it('asymmetric threshold: (2.5, 2.5) → Gargalo (impacto strict, complex inclusive)', () => {
    // Single-item portfolio → spend score auto-derives to 4 (top quartile).
    // impacto = 4*0.4 + c*0.3 + t*0.15 + v*0.15 = 1.6 + 0.3c + 0.15t + 0.15v
    // For 2.5: 0.3c + 0.15t + 0.15v = 0.9 → (c=1, t=2, v=2)
    // complex = (ms+mr+sp+ss)/4. For 2.5: (3,3,2,2)
    const items: KraljicItem[] = [
      { ...baseItem, name: 'Edge', spendMM: 10,
        criticality: 1, technicalSpec: 2, customerValue: 2,
        marketStructure: 3, marketRivalry: 3, supplierPower: 2, supplierSwitching: 2 },
    ];
    const out = classifyItems(items);
    const edge = out.find((i) => i.name === 'Edge')!;
    expect(edge.businessImpact).toBeCloseTo(2.5, 5);
    expect(edge.supplyComplexity).toBeCloseTo(2.5, 5);
    // impacto = 2.5 is NOT > 2.5 → low impact
    // complex = 2.5 IS >= 2.5 → high complexity
    // → Gargalo
    expect(edge.quadrant).toBe('gargalo');
  });
});

describe('summarizeQuadrants', () => {
  it('counts items + sums spend per quadrant', () => {
    const items: KraljicItem[] = [
      { ...baseItem, name: 'A', spendMM: 100, criticality: 4, technicalSpec: 4, customerValue: 4,
        marketStructure: 4, marketRivalry: 4, supplierPower: 4, supplierSwitching: 4 },
      { ...baseItem, name: 'B', spendMM: 1, criticality: 1, technicalSpec: 1, customerValue: 1,
        marketStructure: 1, marketRivalry: 1, supplierPower: 1, supplierSwitching: 1 },
    ];
    const classified = classifyItems(items);
    const sum = summarizeQuadrants(classified);
    expect(sum.estrategico.count + sum['nao-critico'].count).toBe(2);
  });
});

describe('KRALJIC_WEIGHTS', () => {
  it('impacto weights sum to 1.0', () => {
    const w = KRALJIC_WEIGHTS.impacto;
    expect(w.spend + w.criticality + w.technicalSpec + w.customerValue).toBeCloseTo(1, 5);
  });
  it('complexidade weights sum to 1.0', () => {
    const w = KRALJIC_WEIGHTS.complexidade;
    expect(
      w.marketStructure + w.marketRivalry + w.supplierPower + w.supplierSwitching,
    ).toBeCloseTo(1, 5);
  });
});

const template: TemplateRow = {
  id: 'tpl-k',
  assistant_type: 'kraljic',
  name: 'Kraljic Padrão',
  description: 'Template genérico',
  body_md: '# Análise Kraljic — {{cliente}}\n\n## Resumo executivo\n\n<!-- @verbatim-from-here -->\n\n## Apêndice\n\nFooter legal.',
  created_by: null,
  created_at: '2026-05-14T00:00:00Z',
  updated_at: '2026-05-14T00:00:00Z',
};

describe('buildKraljicPrompt', () => {
  it('returns RFP_SYSTEM_PROMPT-like KRALJIC system + user message with portfolio block', () => {
    const items: KraljicItem[] = [
      { ...baseItem, name: 'A', spendMM: 10 },
      { ...baseItem, name: 'B', spendMM: 5 },
    ];
    const classified = classifyItems(items);
    const out = buildKraljicPrompt(
      { portfolioName: 'Test Portfolio', notes: '', items },
      classified,
      template,
      [],
      null,
    );
    expect(out.system).toBe(KRALJIC_SYSTEM_PROMPT);
    expect(out.user).toMatch(/Test Portfolio/);
    expect(out.user).toMatch(/Distribuição por quadrante/);
    expect(out.user).toMatch(/Spend total/);
  });

  it('embeds only the template head (not the verbatim tail)', () => {
    const items: KraljicItem[] = [
      { ...baseItem, name: 'A', spendMM: 10 },
      { ...baseItem, name: 'B', spendMM: 5 },
    ];
    const classified = classifyItems(items);
    const out = buildKraljicPrompt(
      { portfolioName: 'P', notes: '', items },
      classified,
      template,
      [],
      null,
    );
    expect(out.user).toMatch(/Resumo executivo/);
    expect(out.user).not.toMatch(/Footer legal/);
  });
});
