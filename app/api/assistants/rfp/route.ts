import { buildAssistantHandler } from '@/lib/assistants/handler';
import { RfpRequestSchema } from '@/lib/assistants/types';
import { buildRfpPrompt } from '@/lib/assistants/rfp';

export const runtime = 'nodejs';

// POST /api/assistants/rfp — see lib/assistants/handler.ts for the
// shared lifecycle (auth, rate-limit, trace, retrieve+rerank, stream,
// onFinish persist). This route only declares the variation surface.
export const POST = buildAssistantHandler({
  type: 'rfp',
  requestSchema: RfpRequestSchema,
  traceInput: (parsed) => ({
    templateId: parsed.templateId,
    params: parsed.params,
  }),
  // RFP has no deterministic pre-step — retrieval keys on category+scope.
  buildRetrievalQuery: (params) => `${params.category} ${params.scope}`,
  rerankTopN: 8,
  buildPrompt: ({ params, template, chunks, company }) =>
    buildRfpPrompt(params, template, chunks, company),
  generateOp: 'assistant-rfp-generate',
});
