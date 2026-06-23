import { buildAssistantHandler } from '@/lib/assistants/handler';
import { FinancialRequestSchema } from '@/lib/assistants/types';
import {
  buildFinancialPrompt,
  calculateFinancialScore,
  type FinancialAnalysis,
} from '@/lib/assistants/financial';
import { fetchFiscalSnapshot, type FiscalSnapshot } from '@/lib/fiscal/snapshot';

export const runtime = 'nodejs';

// POST /api/assistants/financial — deterministic 0-100 score (4 pillars
// weighted 30/30/20/20) + LLM narrative. Sub-projeto 36 (fase 2): quando há
// CNPJ, anexa um snapshot fiscal (situação cadastral + risco) à narrativa.
// See lib/assistants/handler.ts for the shared lifecycle.
type FinancialClassified = {
  analysis: FinancialAnalysis;
  fiscal: FiscalSnapshot | null;
};

export const POST = buildAssistantHandler<
  typeof FinancialRequestSchema,
  FinancialClassified
>({
  type: 'financial',
  requestSchema: FinancialRequestSchema,
  classify: {
    spanName: 'calculate-score',
    spanOutput: (c) => ({
      score: c.analysis.score,
      rating: c.analysis.rating,
      recommendation: c.analysis.recommendation,
      incomplete: c.analysis.incomplete,
      missingPillars: c.analysis.missingPillars,
      fiscalAvailable: c.fiscal?.available ?? false,
    }),
    run: async (params) => ({
      analysis: calculateFinancialScore(params.indicators),
      // Snapshot fiscal é fail-soft (nunca lança) e só roda com CNPJ.
      fiscal: params.cnpj ? await fetchFiscalSnapshot(params.cnpj) : null,
    }),
  },
  buildRetrievalQuery: (params) =>
    `análise financeira de fornecedor ${params.supplierName} risco de crédito EBITDA liquidez`,
  rerankTopN: 6,
  buildPrompt: ({ params, template, chunks, classified, company }) =>
    buildFinancialPrompt(
      params,
      template,
      chunks,
      classified.analysis,
      company,
      classified.fiscal,
    ),
  generateOp: 'assistant-financial-generate',
  generateMetadata: ({ classified }) => ({ score: classified.analysis.score }),
  annotation: ({ classified }) => ({
    financialScore: classified.analysis.score,
    financialRating: classified.analysis.rating,
    financialRecommendation: classified.analysis.recommendation,
  }),
});
