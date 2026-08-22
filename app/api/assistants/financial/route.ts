import { buildAssistantHandler } from '@/lib/assistants/handler';
import { FinancialRequestSchema } from '@/lib/assistants/types';
import {
  buildFinancialPrompt,
  calculateFinancialScore,
  isFinancialReputacaoEnabled,
  FINANCIAL_REPUTACAO_OPERATION,
  FINANCIAL_REPUTACAO_CONTEXTO,
  type FinancialAnalysis,
} from '@/lib/assistants/financial';
import { fetchFiscalSnapshot, type FiscalSnapshot } from '@/lib/fiscal/snapshot';
import { buscarReputacao, type ReputacaoResult } from '@/lib/fiscal/reputacao';
import { indicadoresAtuais, type IndicadoresAtuais } from '@/lib/govdata/indicadores';

export const runtime = 'nodejs';

// POST /api/assistants/financial — deterministic 0-100 score (4 pillars
// weighted 30/30/20/20) + LLM narrative. Sub-projeto 36 (fase 2): quando há
// CNPJ, anexa um snapshot fiscal (situação cadastral + risco) à narrativa.
// Backlog do diretor 2026-08-19 (Batch F): busca reputacional (pendências
// judiciais/protestos não têm API pública) via FINANCIAL_WEBSEARCH.
// See lib/assistants/handler.ts for the shared lifecycle.
type FinancialClassified = {
  analysis: FinancialAnalysis;
  fiscal: FiscalSnapshot | null;
  macro: IndicadoresAtuais | null;
  reputacao: ReputacaoResult | null;
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
      reputacaoAvailable: c.reputacao?.available ?? false,
    }),
    run: async (params) => {
      // Snapshot fiscal (só com CNPJ) + macro BACEN + reputacional (busca
      // web), todos fail-soft e paralelos.
      const [fiscal, macro, reputacao] = await Promise.all([
        params.cnpj ? fetchFiscalSnapshot(params.cnpj) : Promise.resolve(null),
        indicadoresAtuais().catch(() => null),
        isFinancialReputacaoEnabled()
          ? buscarReputacao({
              razaoSocial: params.supplierName,
              cnpj: params.cnpj || '',
              enabled: true,
              operation: FINANCIAL_REPUTACAO_OPERATION,
              contexto: FINANCIAL_REPUTACAO_CONTEXTO,
            }).catch(() => null)
          : Promise.resolve(null),
      ]);
      return { analysis: calculateFinancialScore(params.indicators), fiscal, macro, reputacao };
    },
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
      classified.macro,
      classified.reputacao,
    ),
  generateOp: 'assistant-financial-generate',
  generateMetadata: ({ classified }) => ({ score: classified.analysis.score }),
  annotation: ({ classified }) => ({
    financialScore: classified.analysis.score,
    financialRating: classified.analysis.rating,
    financialRecommendation: classified.analysis.recommendation,
  }),
});
