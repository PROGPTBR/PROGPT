// tests/lib/assistants/scorecard.test.ts
import { describe, expect, it } from 'vitest';
import { scoreSuppliers, buildScorecardPrompt, SCORECARD_SYSTEM_PROMPT } from '@/lib/assistants/scorecard';
import { DEFAULT_SCORECARD_CRITERIA, SCORECARD_DEFAULT_THRESHOLDS, ScorecardParamsSchema } from '@/lib/assistants/types';
import type { ScorecardParams, TemplateRow } from '@/lib/assistants/types';
import { renderScorecardChartPng } from '@/lib/assistants/scorecard-chart';

function params(overrides: Partial<ScorecardParams> = {}): ScorecardParams {
  return {
    scorecardName: 'Aço plano', period: '', notes: '',
    thresholds: SCORECARD_DEFAULT_THRESHOLDS,
    criteria: [
      { id: 'qualidade', label: 'Qualidade', weight: 50 },
      { id: 'preco', label: 'Preço', weight: 50 },
    ],
    suppliers: [
      { name: 'Forn A', segment: '', scores: { qualidade: 10, preco: 10 } },
      { name: 'Forn B', segment: '', scores: { qualidade: 5, preco: 5 } },
      { name: 'Forn C', segment: '', scores: { qualidade: 2, preco: 2 } },
    ],
    ...overrides,
  };
}

describe('scoreSuppliers', () => {
  it('computes weighted score 0-100 and ranks desc', () => {
    const out = scoreSuppliers(params());
    expect(out).toHaveLength(3);
    expect(out[0]!.name).toBe('Forn A');
    expect(out[0]!.weightedScore).toBe(100);
    expect(out[0]!.rank).toBe(1);
    expect(out[1]!.weightedScore).toBe(50);
    expect(out[2]!.weightedScore).toBe(20);
  });
  it('normalizes weights that do not sum to 100', () => {
    const out = scoreSuppliers(params({
      criteria: [
        { id: 'qualidade', label: 'Qualidade', weight: 3 },
        { id: 'preco', label: 'Preço', weight: 1 },
      ],
      suppliers: [{ name: 'X', segment: '', scores: { qualidade: 10, preco: 0 } }],
    }));
    expect(out[0]!.weightedScore).toBe(75);
  });
  it('assigns bands by threshold (>=70 estrategico, >=40 desenvolvimento, else saida)', () => {
    const out = scoreSuppliers(params());
    expect(out.find((s) => s.name === 'Forn A')!.band).toBe('estrategico');
    expect(out.find((s) => s.name === 'Forn B')!.band).toBe('desenvolvimento');
    expect(out.find((s) => s.name === 'Forn C')!.band).toBe('saida');
  });
  it('is stable on ties (input order preserved within equal scores)', () => {
    const out = scoreSuppliers(params({
      suppliers: [
        { name: 'First', segment: '', scores: { qualidade: 5, preco: 5 } },
        { name: 'Second', segment: '', scores: { qualidade: 5, preco: 5 } },
      ],
    }));
    expect(out.map((s) => s.name)).toEqual(['First', 'Second']);
    expect(out[0]!.rank).toBe(1);
    expect(out[1]!.rank).toBe(2);
  });
  it('ships 6 default criteria summing to 100', () => {
    expect(DEFAULT_SCORECARD_CRITERIA).toHaveLength(6);
    expect(DEFAULT_SCORECARD_CRITERIA.reduce((a, c) => a + c.weight, 0)).toBe(100);
  });
  it('band boundaries are inclusive at the thresholds (exactly 70 and 40)', () => {
    const out = scoreSuppliers(
      params({
        suppliers: [
          { name: 'at70', segment: '', scores: { qualidade: 7, preco: 7 } }, // 70 → estrategico
          { name: 'at40', segment: '', scores: { qualidade: 4, preco: 4 } }, // 40 → desenvolvimento
          { name: 'below40', segment: '', scores: { qualidade: 3, preco: 4 } }, // 35 → saida
        ],
      }),
    );
    expect(out.find((s) => s.name === 'at70')!.band).toBe('estrategico');
    expect(out.find((s) => s.name === 'at40')!.band).toBe('desenvolvimento');
    expect(out.find((s) => s.name === 'below40')!.band).toBe('saida');
  });
});

const tpl: TemplateRow = {
  id: 't', assistant_type: 'scorecard', name: 'Padrão', description: null,
  body_md: '# Head\n\nTail.', created_by: null, created_at: '', updated_at: '',
};

describe('renderScorecardChartPng', () => {
  it('returns a PNG buffer', async () => {
    const buf = await renderScorecardChartPng(scoreSuppliers(params()));
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString('hex')).toBe('89504e47'); // PNG magic
  });
  it('handles a single supplier without throwing', async () => {
    const out = scoreSuppliers(params({ suppliers: [{ name: 'Solo', segment: '', scores: { qualidade: 8, preco: 6 } }] }));
    const buf = await renderScorecardChartPng(out);
    expect(Buffer.isBuffer(buf)).toBe(true);
  });
});

describe('buildScorecardPrompt', () => {
  it('passes classification as INPUT (ranking + band per supplier) and keeps system byte-stable', () => {
    const classified = scoreSuppliers(params());
    const { system, user } = buildScorecardPrompt(params(), classified, tpl, [], null);
    expect(system).toBe(SCORECARD_SYSTEM_PROMPT);
    expect(user).toContain('Forn A');
    expect(user).toContain('Estratégico');
    expect(user).toMatch(/classifica|ranking/i);
  });
});

describe('ScorecardParamsSchema uniqueness', () => {
  it('rejects duplicate criterion ids', () => {
    const r = ScorecardParamsSchema.safeParse({
      scorecardName: 'X',
      criteria: [
        { id: 'preco', label: 'Preço', weight: 50 },
        { id: 'preco', label: 'Preco', weight: 50 },
      ],
      suppliers: [{ name: 'A', segment: '', scores: { preco: 8 } }],
    });
    expect(r.success).toBe(false);
  });
  it('accepts unique criterion ids', () => {
    const r = ScorecardParamsSchema.safeParse({
      scorecardName: 'X',
      criteria: [
        { id: 'preco', label: 'Preço', weight: 50 },
        { id: 'preco-2', label: 'Preco', weight: 50 },
      ],
      suppliers: [{ name: 'A', segment: '', scores: { preco: 8, 'preco-2': 6 } }],
    });
    expect(r.success).toBe(true);
  });
});
