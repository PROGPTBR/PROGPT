import { buildAssistantHandler } from '@/lib/assistants/handler';
import { ScorecardRequestSchema } from '@/lib/assistants/types';
import { scoreSuppliers, buildScorecardPrompt } from '@/lib/assistants/scorecard';
import type { ClassifiedSupplier } from '@/lib/assistants/types';

export const runtime = 'nodejs';

// POST /api/assistants/scorecard — deterministic supplier scoring (weighted
// scorecard → Estratégico / Desenvolvimento / Saída bands) + LLM narrative.
// See lib/assistants/handler.ts for the shared lifecycle.
export const POST = buildAssistantHandler<
  typeof ScorecardRequestSchema,
  ClassifiedSupplier[]
>({
  type: 'scorecard',
  requestSchema: ScorecardRequestSchema,
  traceInput: (parsed) => ({
    templateId: parsed.templateId,
    scorecardName: parsed.params.scorecardName,
    supplierCount: parsed.params.suppliers.length,
  }),
  classify: {
    spanInput: (params) => ({ count: params.suppliers.length }),
    spanOutput: (classified) => ({
      estrategico: classified.filter((s) => s.band === 'estrategico').length,
      desenvolvimento: classified.filter((s) => s.band === 'desenvolvimento').length,
      saida: classified.filter((s) => s.band === 'saida').length,
    }),
    run: (params) => scoreSuppliers(params),
  },
  buildRetrievalQuery: (params) =>
    `Avaliação e gestão de fornecedores SRM supplier scorecard ${params.scorecardName}`,
  rerankTopN: 6,
  buildPrompt: ({ params, template, chunks, classified, company }) =>
    buildScorecardPrompt(params, classified, template, chunks, company),
  generateOp: 'assistant-scorecard-generate',
  annotation: ({ classified }) => ({ supplierCount: classified.length }),
  paramsForAssembly: (params, company) => ({
    client: company?.company_name ?? '',
    scope: params.scorecardName,
    category: 'Scorecard de fornecedores',
    deadline: '',
    budget: '',
    criteria: [],
    notes: params.notes ?? '',
  }),
});
