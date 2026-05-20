import { buildAssistantHandler } from '@/lib/assistants/handler';
import { ProfileRequestSchema } from '@/lib/assistants/types';
import { buildProfilePrompt } from '@/lib/assistants/profile';

export const runtime = 'nodejs';

// POST /api/assistants/profile — generate a Category Profile (Strategic
// Sourcing Step 1). Pure narrative — no deterministic pre-step. See
// lib/assistants/handler.ts for the shared lifecycle.
export const POST = buildAssistantHandler({
  type: 'profile',
  requestSchema: ProfileRequestSchema,
  traceInput: (parsed) => ({
    templateId: parsed.templateId,
    nomeCategoria: parsed.params.nomeCategoria,
    subSegmentosCount: parsed.params.subSegmentos.length,
  }),
  buildRetrievalQuery: (params) =>
    `${params.nomeCategoria} ${params.descricao.slice(0, 200)} ${params.subSegmentos.join(' ')}`.slice(
      0,
      400,
    ),
  rerankTopN: 6,
  buildPrompt: ({ params, template, chunks, company }) =>
    buildProfilePrompt(params, template, chunks, company),
  generateOp: 'assistant-profile-generate',
});
