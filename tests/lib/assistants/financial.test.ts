import { describe, expect, it } from 'vitest';
import {
  buildFinancialPrompt,
  calculateFinancialScore,
  FINANCIAL_SYSTEM_PROMPT,
} from '@/lib/assistants/financial';
import type {
  FinancialIndicators,
  FinancialParams,
  TemplateRow,
} from '@/lib/assistants/types';
import type { RetrievedChunk } from '@/lib/rag/types';

const baseTemplate: TemplateRow = {
  id: 'tpl-fin-1',
  assistant_type: 'financial',
  name: 'Template padrão',
  description: 'Default template',
  body_md: `# Análise Financeira — {{fornecedor}}

> CNPJ: {{cnpj}}

## 1. Liquidez
(análise)

<!-- @verbatim-from-here -->

## Apêndice
Confidencialidade.`,
  created_by: null,
  created_at: '2026-05-19T00:00:00Z',
  updated_at: '2026-05-19T00:00:00Z',
};

describe('calculateFinancialScore — pillar scoring tables', () => {
  it('scores top-tier company at ~100', () => {
    const ind: FinancialIndicators = {
      liquidezCorrente: 2.0,
      dividaLiquidaEbitda: 0.5,
      margemEbitdaPct: 25,
      roePct: 20,
      ebitda: 100,
    };
    const r = calculateFinancialScore(ind);
    expect(r.score).toBeCloseTo(100, 1);
    expect(r.rating).toBe('excellent');
    expect(r.recommendation).toBe('buy');
    expect(r.incomplete).toBe(false);
  });

  it('scores caution-tier company in the 35-60 band', () => {
    const ind: FinancialIndicators = {
      liquidezCorrente: 0.9, // 40 pts
      dividaLiquidaEbitda: 2.5, // 70 pts
      margemEbitdaPct: 7, // 40 pts
      roePct: 5, // 40 pts
      ebitda: 10,
    };
    const r = calculateFinancialScore(ind);
    // 40*0.3 + 70*0.3 + 40*0.2 + 40*0.2 = 12 + 21 + 8 + 8 = 49
    expect(r.score).toBeCloseTo(49, 0);
    expect(r.rating).toBe('caution');
    expect(r.recommendation).toBe('caution');
  });

  it('scores poor company near zero', () => {
    const ind: FinancialIndicators = {
      liquidezCorrente: 0.5, // 0
      dividaLiquidaEbitda: 6, // 0
      margemEbitdaPct: 2, // 0
      roePct: -5, // 0
      ebitda: 1,
    };
    const r = calculateFinancialScore(ind);
    expect(r.score).toBe(0);
    expect(r.rating).toBe('poor');
    expect(r.recommendation).toBe('do_not_buy');
  });

  it('treats negative EBITDA as zero pts on the debt pillar regardless of ratio', () => {
    const ind: FinancialIndicators = {
      liquidezCorrente: 1.2,
      dividaLiquidaEbitda: 0.5, // would be 100 pts...
      ebitda: -10, // ...but negative EBITDA → 0 pts
      margemEbitdaPct: 0,
      roePct: 0,
    };
    const r = calculateFinancialScore(ind);
    // 70*0.3 (liquidity) + 0*0.3 (debt) + 0*0.2 + 40*0.2 = 21 + 0 + 0 + 8 = 29
    expect(r.score).toBeCloseTo(29, 0);
    expect(r.pillars.debt.points).toBe(0);
  });

  it('flags incomplete + lists missing pillars when 4 pillars are not all provided', () => {
    const ind: FinancialIndicators = { liquidezCorrente: 1.5 };
    const r = calculateFinancialScore(ind);
    expect(r.incomplete).toBe(true);
    expect(r.missingPillars).toContain('Dívida Líquida / EBITDA');
    expect(r.missingPillars).toContain('Margem EBITDA');
    expect(r.missingPillars).toContain('ROE');
    expect(r.missingPillars).not.toContain('Liquidez Corrente');
  });

  it('hits Liquidity boundary cases', () => {
    expect(calculateFinancialScore({ liquidezCorrente: 1.51 }).pillars.liquidity.points).toBe(100);
    expect(calculateFinancialScore({ liquidezCorrente: 1.1 }).pillars.liquidity.points).toBe(70);
    expect(calculateFinancialScore({ liquidezCorrente: 0.8 }).pillars.liquidity.points).toBe(40);
    expect(calculateFinancialScore({ liquidezCorrente: 0.79 }).pillars.liquidity.points).toBe(0);
  });

  it('hits ROE boundary cases (including negative)', () => {
    expect(calculateFinancialScore({ roePct: 15.5 }).pillars.roe.points).toBe(100);
    expect(calculateFinancialScore({ roePct: 8 }).pillars.roe.points).toBe(70);
    expect(calculateFinancialScore({ roePct: 0 }).pillars.roe.points).toBe(40);
    expect(calculateFinancialScore({ roePct: -1 }).pillars.roe.points).toBe(0);
  });
});

describe('buildFinancialPrompt', () => {
  const params: FinancialParams = {
    supplierName: 'Acme Indústria S.A.',
    cnpj: '00.000.000/0001-00',
    referenceYear: '2024',
    observacoes: 'Spend anual estimado R$ 8M',
    indicators: {
      receitaLiquida: 500,
      ebitda: 100,
      liquidezCorrente: 1.8,
      dividaLiquidaEbitda: 2,
      margemEbitdaPct: 20,
      roePct: 18,
    },
  };

  it('returns FINANCIAL_SYSTEM_PROMPT as system', () => {
    const a = calculateFinancialScore(params.indicators);
    const out = buildFinancialPrompt(params, baseTemplate, [], a, null);
    expect(out.system).toBe(FINANCIAL_SYSTEM_PROMPT);
  });

  it('embeds the deterministic classification block with score + recommendation', () => {
    const a = calculateFinancialScore(params.indicators);
    const out = buildFinancialPrompt(params, baseTemplate, [], a, null);
    expect(out.user).toContain('<financial-classification>');
    expect(out.user).toContain(`Score Financeiro: ${a.score}/100`);
    expect(out.user).toContain(`recomendação: **${a.recommendation}**`);
    expect(out.user).toContain('Liquidez Corrente (30%)');
    expect(out.user).toContain('Dívida Líquida/EBITDA (30%)');
    expect(out.user).toContain('Margem EBITDA (20%)');
    expect(out.user).toContain('ROE (20%)');
  });

  it('renders supplier name placeholder in the template head', () => {
    const a = calculateFinancialScore(params.indicators);
    const out = buildFinancialPrompt(params, baseTemplate, [], a, null);
    expect(out.user).toContain('Análise Financeira — Acme Indústria S.A.');
    expect(out.user).toContain('CNPJ: 00.000.000/0001-00');
  });

  it('omits the verbatim tail from the prompt — assembled server-side', () => {
    const a = calculateFinancialScore(params.indicators);
    const out = buildFinancialPrompt(params, baseTemplate, [], a, null);
    expect(out.user).not.toContain('Confidencialidade.');
  });

  it('renders all 12 indicators in the indicators block (N/D for absent)', () => {
    const a = calculateFinancialScore(params.indicators);
    const out = buildFinancialPrompt(params, baseTemplate, [], a, null);
    expect(out.user).toMatch(/Receita Líquida.*500/);
    expect(out.user).toMatch(/EBITDA.*100/);
    expect(out.user).toMatch(/Liquidez Corrente.*1\.8/);
    // ROIC was not provided → N/D
    expect(out.user).toMatch(/ROIC.*N\/D/);
  });

  it('system prompt instructs LLM not to recalculate the score', () => {
    expect(FINANCIAL_SYSTEM_PROMPT).toMatch(/NÃO recalcule|INPUT DETERMINÍSTICO/i);
  });

  it('system prompt cites the 4 pillars + weights', () => {
    expect(FINANCIAL_SYSTEM_PROMPT).toMatch(/Liquidez Corrente 30%/i);
    expect(FINANCIAL_SYSTEM_PROMPT).toMatch(/Dívida Líquida\/EBITDA 30%/i);
    expect(FINANCIAL_SYSTEM_PROMPT).toMatch(/Margem EBITDA 20%/i);
    expect(FINANCIAL_SYSTEM_PROMPT).toMatch(/ROE 20%/i);
  });

  it('system prompt asks for a payment-terms recommendation', () => {
    expect(FINANCIAL_SYSTEM_PROMPT).toMatch(/Termos de pagamento/i);
  });

  it('uses retrieval chunks when provided', () => {
    const chunk: RetrievedChunk = {
      chunkId: 'c1',
      articleId: 'a1',
      articleTitle: 'Análise de crédito corporativo — princípios',
      content: 'Liquidez corrente acima de 1.5 indica folga financeira de curto prazo.',
      ord: 0,
      vectorRank: 1,
      ftsRank: 1,
      rrfScore: 0.5,
      rerankScore: 0.9,
    };
    const a = calculateFinancialScore(params.indicators);
    const out = buildFinancialPrompt(params, baseTemplate, [chunk], a, null);
    expect(out.user).toContain('Análise de crédito corporativo');
  });
});
