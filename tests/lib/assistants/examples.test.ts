import { describe, it, expect } from 'vitest';
import {
  PROFILE_EXAMPLES,
  SCORECARD_EXAMPLES,
  RFP_EXAMPLES,
  KRALJIC_EXAMPLES,
  ABC_EXAMPLES,
  FINANCIAL_EXAMPLES,
  PORTER_EXAMPLES,
} from '@/lib/assistants/examples';
import {
  ProfileParamsSchema,
  ScorecardParamsSchema,
  RfpParamsSchema,
  KraljicParamsSchema,
  AbcParamsSchema,
  FinancialParamsSchema,
  PorterParamsSchema,
} from '@/lib/assistants/types';

// The whole point of the examples is that "Carregar exemplo" yields a form that
// submits without edits. So every example MUST satisfy the exact submit schema —
// this test fails loudly if any field name/type/length drifts.
describe('assistant form examples', () => {
  it('has at least one example per form', () => {
    expect(PROFILE_EXAMPLES.length).toBeGreaterThan(0);
    expect(SCORECARD_EXAMPLES.length).toBeGreaterThan(0);
    expect(RFP_EXAMPLES.length).toBeGreaterThan(0);
    expect(KRALJIC_EXAMPLES.length).toBeGreaterThan(0);
    expect(ABC_EXAMPLES.length).toBeGreaterThan(0);
    expect(FINANCIAL_EXAMPLES.length).toBeGreaterThan(0);
    expect(PORTER_EXAMPLES.length).toBeGreaterThan(0);
  });

  it('every profile example satisfies ProfileParamsSchema', () => {
    for (const ex of PROFILE_EXAMPLES) {
      expect(() => ProfileParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });

  it('every scorecard example satisfies ScorecardParamsSchema', () => {
    for (const ex of SCORECARD_EXAMPLES) {
      expect(() => ScorecardParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });

  it('every rfp example satisfies RfpParamsSchema', () => {
    for (const ex of RFP_EXAMPLES) {
      expect(() => RfpParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });

  it('every kraljic example satisfies KraljicParamsSchema', () => {
    for (const ex of KRALJIC_EXAMPLES) {
      expect(() => KraljicParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });

  it('every abc example satisfies AbcParamsSchema', () => {
    for (const ex of ABC_EXAMPLES) {
      expect(() => AbcParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });

  it('every financial example satisfies FinancialParamsSchema', () => {
    for (const ex of FINANCIAL_EXAMPLES) {
      expect(() => FinancialParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });

  it('every porter example satisfies PorterParamsSchema', () => {
    for (const ex of PORTER_EXAMPLES) {
      expect(() => PorterParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });
});
