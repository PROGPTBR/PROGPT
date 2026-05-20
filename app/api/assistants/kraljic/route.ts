import { buildAssistantHandler } from '@/lib/assistants/handler';
import { KraljicRequestSchema } from '@/lib/assistants/types';
import { classifyItems, buildKraljicPrompt } from '@/lib/assistants/kraljic';
import type { ClassifiedKraljicItem } from '@/lib/assistants/types';

export const runtime = 'nodejs';

// POST /api/assistants/kraljic — deterministic classification (4-quadrant
// portfolio) + LLM narrative. See lib/assistants/handler.ts for the
// shared lifecycle.
export const POST = buildAssistantHandler<
  typeof KraljicRequestSchema,
  ClassifiedKraljicItem[]
>({
  type: 'kraljic',
  requestSchema: KraljicRequestSchema,
  traceInput: (parsed) => ({
    templateId: parsed.templateId,
    portfolioName: parsed.params.portfolioName,
    itemCount: parsed.params.items.length,
  }),
  classify: {
    spanInput: (params) => ({ count: params.items.length }),
    spanOutput: (classified) => ({
      estrategico: classified.filter((c) => c.quadrant === 'estrategico').length,
      alavancavel: classified.filter((c) => c.quadrant === 'alavancavel').length,
      gargalo: classified.filter((c) => c.quadrant === 'gargalo').length,
      naoCritico: classified.filter((c) => c.quadrant === 'nao-critico').length,
    }),
    run: (params) => classifyItems(params.items),
  },
  buildRetrievalQuery: (params, classified) => {
    const topCategories = Array.from(
      new Set(classified.map((c) => c.category).filter(Boolean)),
    ).slice(0, 3);
    return `Matriz de Kraljic ${params.portfolioName} ${topCategories.join(' ')}`;
  },
  rerankTopN: 6,
  buildPrompt: ({ params, template, chunks, classified, company }) =>
    buildKraljicPrompt(params, classified, template, chunks, company),
  generateOp: 'assistant-kraljic-generate',
  annotation: ({ classified }) => ({ itemCount: classified.length }),
  paramsForAssembly: (params, company) => ({
    client: company?.company_name ?? '',
    scope: params.portfolioName,
    category: 'Análise de portfólio (Kraljic)',
    deadline: '',
    budget: '',
    criteria: [],
    notes: params.notes ?? '',
  }),
});
