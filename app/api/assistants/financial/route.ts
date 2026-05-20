import { buildAssistantHandler } from '@/lib/assistants/handler';
import { FinancialRequestSchema } from '@/lib/assistants/types';
import {
  buildFinancialPrompt,
  calculateFinancialScore,
  type FinancialAnalysis,
} from '@/lib/assistants/financial';

export const runtime = 'nodejs';

// POST /api/assistants/financial — deterministic 0-100 score (4 pillars
// weighted 30/30/20/20) + LLM narrative. See lib/assistants/handler.ts
// for the shared lifecycle.
export const POST = buildAssistantHandler<
  typeof FinancialRequestSchema,
  FinancialAnalysis
>({
  type: 'financial',
  requestSchema: FinancialRequestSchema,
  classify: {
    spanName: 'calculate-score',
    spanOutput: (analysis) => ({
      score: analysis.score,
      rating: analysis.rating,
      recommendation: analysis.recommendation,
      incomplete: analysis.incomplete,
      missingPillars: analysis.missingPillars,
    }),
    run: (params) => calculateFinancialScore(params.indicators),
  },
  buildRetrievalQuery: (params) =>
    `análise financeira de fornecedor ${params.supplierName} risco de crédito EBITDA liquidez`,
  rerankTopN: 6,
  buildPrompt: ({ params, template, chunks, classified, company }) =>
    buildFinancialPrompt(params, template, chunks, classified, company),
  generateOp: 'assistant-financial-generate',
  generateMetadata: ({ classified }) => ({ score: classified.score }),
  annotation: ({ classified }) => ({
    financialScore: classified.score,
    financialRating: classified.rating,
    financialRecommendation: classified.recommendation,
  }),
});
