import { buildAssistantHandler } from '@/lib/assistants/handler';
import { AbcRequestSchema } from '@/lib/assistants/types';
import { buildAbcPrompt, classifyAbc } from '@/lib/assistants/abc';
import type { AbcAnalysis } from '@/lib/assistants/types';

export const runtime = 'nodejs';

// POST /api/assistants/abc — deterministic Pareto classification + LLM
// narrative. See lib/assistants/handler.ts for the shared lifecycle.
export const POST = buildAssistantHandler<
  typeof AbcRequestSchema,
  AbcAnalysis
>({
  type: 'abc',
  requestSchema: AbcRequestSchema,
  traceInput: (parsed) => ({
    templateId: parsed.templateId,
    itemCount: parsed.params.items.length,
  }),
  classify: {
    spanInput: (params) => ({ itemCount: params.items.length }),
    spanOutput: (analysis) => ({
      totalSpend: analysis.totalSpend,
      totalItems: analysis.totalItems,
      countA: analysis.byClass.A.count,
      countB: analysis.byClass.B.count,
      countC: analysis.byClass.C.count,
    }),
    run: (params) => classifyAbc(params),
  },
  buildRetrievalQuery: (_params, analysis) => {
    const topNames = analysis.items
      .slice(0, 5)
      .map((i) => i.name)
      .join(' ');
    return `curva ABC Pareto spend analysis consolidação fornecedor ${topNames}`.slice(
      0,
      400,
    );
  },
  rerankTopN: 6,
  buildPrompt: ({ params, template, chunks, classified, company }) =>
    buildAbcPrompt(params, template, chunks, classified, company),
  generateOp: 'assistant-abc-generate',
  generateMetadata: ({ params }) => ({ item_count: params.items.length }),
  annotation: ({ classified }) => ({
    abcCounts: {
      A: classified.byClass.A.count,
      B: classified.byClass.B.count,
      C: classified.byClass.C.count,
    },
  }),
});
