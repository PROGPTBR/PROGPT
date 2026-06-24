import { describe, it, expect } from 'vitest';
import {
  PROFILE_EXAMPLES,
  SCORECARD_EXAMPLES,
  RFP_EXAMPLES,
  KRALJIC_EXAMPLES,
  ABC_EXAMPLES,
  FINANCIAL_EXAMPLES,
  PORTER_EXAMPLES,
  HOMOLOGACAO_EXAMPLES,
  PESQUISA_PRECOS_EXAMPLES,
  SPEND_ANALYSIS_EXAMPLES,
} from '@/lib/assistants/examples';
import {
  ProfileParamsSchema,
  ScorecardParamsSchema,
  RfpParamsSchema,
  KraljicParamsSchema,
  AbcParamsSchema,
  FinancialParamsSchema,
  PorterParamsSchema,
  HomologacaoParamsSchema,
  PesquisaPrecosParamsSchema,
  SpendAnalysisParamsSchema,
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
    expect(HOMOLOGACAO_EXAMPLES.length).toBeGreaterThan(0);
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

  it('every homologacao example satisfies HomologacaoParamsSchema', () => {
    for (const ex of HOMOLOGACAO_EXAMPLES) {
      expect(() => HomologacaoParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });

  it('pesquisa_precos examples exist and satisfy PesquisaPrecosParamsSchema', () => {
    expect(PESQUISA_PRECOS_EXAMPLES.length).toBeGreaterThan(0);
    for (const ex of PESQUISA_PRECOS_EXAMPLES) {
      expect(() => PesquisaPrecosParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });

  it('spend_analysis examples exist and satisfy SpendAnalysisParamsSchema', () => {
    expect(SPEND_ANALYSIS_EXAMPLES.length).toBeGreaterThan(0);
    for (const ex of SPEND_ANALYSIS_EXAMPLES) {
      expect(() => SpendAnalysisParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });
});
