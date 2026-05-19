import { describe, expect, it } from 'vitest';
import {
  buildRefineSystemForType,
  RFP_REFINE_SYSTEM_PROMPT,
  KRALJIC_REFINE_SYSTEM_PROMPT,
  PORTER_REFINE_SYSTEM_PROMPT,
  FINANCIAL_REFINE_SYSTEM_PROMPT,
} from '@/lib/assistants/refine';
import type {
  RfpParams,
  KraljicParams,
  PorterParams,
  FinancialParams,
} from '@/lib/assistants/types';

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

  it('returns the Porter refine system prompt when assistant_type=porter', () => {
    const porterParams: PorterParams = {
      categoria: 'Embalagens flexíveis',
      segmento: 'Direto',
      escopo: 'Brasil',
      observacoes: '',
      // Minimum 5 entries — see PorterParamsSchema. Content is irrelevant
      // for the dispatch test; this exercises only the type plumbing.
      statements: [
        { id: 'S1-1', weight: 2, score: 3 },
        { id: 'S2-1', weight: 2, score: 3 },
        { id: 'S3-1', weight: 2, score: 3 },
        { id: 'S4-1', weight: 2, score: 3 },
        { id: 'S5-1', weight: 2, score: 3 },
      ],
    };
    const out = buildRefineSystemForType(
      'porter',
      '# Análise das 5 Forças',
      porterParams,
      [],
    );
    expect(out).toContain(PORTER_REFINE_SYSTEM_PROMPT);
    expect(out).not.toContain(RFP_REFINE_SYSTEM_PROMPT);
    expect(out).not.toContain(KRALJIC_REFINE_SYSTEM_PROMPT);
    expect(out).toMatch(/<analysis>/);
    expect(out).toMatch(/Embalagens flexíveis/);
  });

  it('Porter refine prompt cites canonical sources + the 5 forces', () => {
    expect(PORTER_REFINE_SYSTEM_PROMPT).toMatch(/Porter 1979/);
    expect(PORTER_REFINE_SYSTEM_PROMPT).toMatch(/rivalidade/i);
    expect(PORTER_REFINE_SYSTEM_PROMPT).toMatch(/novos entrantes/i);
    expect(PORTER_REFINE_SYSTEM_PROMPT).toMatch(/substitutos/i);
    expect(PORTER_REFINE_SYSTEM_PROMPT).toMatch(/fornecedores/i);
    expect(PORTER_REFINE_SYSTEM_PROMPT).toMatch(/compradores/i);
  });

  it('Porter refine prompt allows intensity reclassification (unlike Kraljic)', () => {
    expect(PORTER_REFINE_SYSTEM_PROMPT).toMatch(
      /Reclassificação.*OK|diferente de Kraljic/i,
    );
  });

  it('returns the Financial refine system prompt when assistant_type=financial', () => {
    const financialParams: FinancialParams = {
      supplierName: 'Acme Indústria S.A.',
      cnpj: '00.000.000/0001-00',
      referenceYear: '2024',
      observacoes: '',
      indicators: {
        liquidezCorrente: 1.5,
        dividaLiquidaEbitda: 2,
        margemEbitdaPct: 15,
        roePct: 12,
      },
    };
    const out = buildRefineSystemForType(
      'financial',
      '# Relatório financeiro',
      financialParams,
      [],
    );
    expect(out).toContain(FINANCIAL_REFINE_SYSTEM_PROMPT);
    expect(out).not.toContain(RFP_REFINE_SYSTEM_PROMPT);
    expect(out).not.toContain(KRALJIC_REFINE_SYSTEM_PROMPT);
    expect(out).not.toContain(PORTER_REFINE_SYSTEM_PROMPT);
    expect(out).toMatch(/<report>/);
    expect(out).toMatch(/Acme Indústria/);
  });

  it('Financial refine prompt protects the deterministic score', () => {
    expect(FINANCIAL_REFINE_SYSTEM_PROMPT).toMatch(/NÃO altere a pontuação|score/i);
    expect(FINANCIAL_REFINE_SYSTEM_PROMPT).toMatch(/buy|caution|do_not_buy/i);
  });
});
