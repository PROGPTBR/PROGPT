import { describe, expect, it } from 'vitest';
import {
  buildRefineSystemForType,
  RFP_REFINE_SYSTEM_PROMPT,
  KRALJIC_REFINE_SYSTEM_PROMPT,
} from '@/lib/assistants/refine';
import type { RfpParams, KraljicParams } from '@/lib/assistants/types';

const rfpParams: RfpParams = {
  client: 'ACME',
  scope: 'Software',
  category: 'TI',
  deadline: '30d',
  budget: 'R$ 100k',
  criteria: [],
  notes: '',
};

const kraljicParams: KraljicParams = {
  portfolioName: 'Portfolio X',
  analysisPeriod: '2026 Q2',
  notes: '',
  items: [
    { name: 'A', segment: '', category: '', spendMM: 10,
      criticality: 2, technicalSpec: 2, customerValue: 2,
      marketStructure: 2, marketRivalry: 2, supplierPower: 2, supplierSwitching: 2 },
  ],
};

describe('buildRefineSystemForType', () => {
  it('returns the RFP refine system prompt when assistant_type=rfp', () => {
    const out = buildRefineSystemForType('rfp', '# RFP body', rfpParams, []);
    expect(out).toContain(RFP_REFINE_SYSTEM_PROMPT);
    expect(out).not.toContain(KRALJIC_REFINE_SYSTEM_PROMPT);
    expect(out).toMatch(/<rfp>/);
    expect(out).toMatch(/ACME/);
  });

  it('returns the Kraljic refine system prompt when assistant_type=kraljic', () => {
    const out = buildRefineSystemForType(
      'kraljic',
      '# Analysis body',
      kraljicParams,
      [],
    );
    expect(out).toContain(KRALJIC_REFINE_SYSTEM_PROMPT);
    expect(out).not.toContain(RFP_REFINE_SYSTEM_PROMPT);
    expect(out).toMatch(/<analysis>/);
    expect(out).toMatch(/<items>/);
    expect(out).toMatch(/Portfolio X/);
    expect(out).toMatch(/2026 Q2/);
  });

  it('Kraljic refine prompt instructs against changing scores/quadrants', () => {
    expect(KRALJIC_REFINE_SYSTEM_PROMPT).toMatch(/NÃO altere a classificação|reclassificação/i);
    expect(KRALJIC_REFINE_SYSTEM_PROMPT).toMatch(/Kraljic 1983/);
    expect(KRALJIC_REFINE_SYSTEM_PROMPT).toMatch(/Gelderman/);
  });

  it('RFP refine prompt still mandates section-specific suggestions', () => {
    expect(RFP_REFINE_SYSTEM_PROMPT).toMatch(/cláusula|seção/i);
    expect(RFP_REFINE_SYSTEM_PROMPT).toMatch(/RFP/);
  });
});
