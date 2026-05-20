import { buildAssistantHandler } from '@/lib/assistants/handler';
import { PorterRequestSchema } from '@/lib/assistants/types';
import {
  buildPorterPrompt,
  classifyPorterForces,
  type PorterClassification,
} from '@/lib/assistants/porter';

export const runtime = 'nodejs';

// POST /api/assistants/porter — deterministic 5-forces scoring + LLM
// narrative. See lib/assistants/handler.ts for the shared lifecycle.
export const POST = buildAssistantHandler<
  typeof PorterRequestSchema,
  PorterClassification
>({
  type: 'porter',
  requestSchema: PorterRequestSchema,
  classify: {
    spanInput: (params) => ({ statementCount: params.statements.length }),
    spanOutput: (classification) => ({
      overall: classification.overallAvg,
      overallIntensity: classification.overallIntensity,
      byForce: classification.byForce.map((f) => ({
        force: f.force,
        avg: f.weightedAvg,
        intensity: f.intensity,
      })),
    }),
    run: (params) => classifyPorterForces(params.statements),
  },
  // Retrieval anchored on category + 'porter forças competitivas' so we
  // bias toward the canonical Porter material in the corpus (HBR 1979,
  // Competitive Strategy 1980, Competitive Advantage 1985).
  buildRetrievalQuery: (params) =>
    `${params.categoria} ${params.segmento ?? ''} 5 forças de Porter rivalidade fornecedores compradores`,
  rerankTopN: 8,
  buildPrompt: ({ params, template, chunks, classified, company }) =>
    buildPorterPrompt(params, template, chunks, classified, company),
  generateOp: 'assistant-porter-generate',
});
