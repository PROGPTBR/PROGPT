import { buildAssistantHandler } from '@/lib/assistants/handler';
import { DiagnosticoAquisicaoRequestSchema } from '@/lib/assistants/types';
import {
  classifyAquisicao,
  buildDiagnosticoAquisicaoPrompt,
} from '@/lib/assistants/diagnostico-aquisicao';
import type { ClassifiedDiagnosticoAquisicao } from '@/lib/assistants/types';

export const runtime = 'nodejs';

// POST /api/assistants/diagnostico_aquisicao — deterministic CAPEX/OPEX →
// KPI + SOURCE/CONTRACT/BUY classification + LLM narrative. See
// lib/assistants/handler.ts for the shared lifecycle.
export const POST = buildAssistantHandler<
  typeof DiagnosticoAquisicaoRequestSchema,
  ClassifiedDiagnosticoAquisicao
>({
  type: 'diagnostico_aquisicao',
  requestSchema: DiagnosticoAquisicaoRequestSchema,
  traceInput: (parsed) => ({
    templateId: parsed.templateId,
    descricaoCompra: parsed.params.descricaoCompra,
    classificacao: parsed.params.classificacao,
  }),
  classify: {
    spanInput: (params) => ({
      classificacao: params.classificacao,
      criticidade: params.criticidade,
      complexidadeMercado: params.complexidadeMercado,
      impactoOperacional: params.impactoOperacional,
    }),
    spanOutput: (classified) => ({
      leaning: classified.leaning,
      totalScore: classified.totalScore,
    }),
    run: (params) => classifyAquisicao(params),
  },
  buildRetrievalQuery: (params, classified) =>
    `${params.classificacao} ${params.categoria} ${params.descricaoCompra} estratégia de sourcing ${classified.leaning} make-or-buy`.slice(
      0,
      400,
    ),
  rerankTopN: 6,
  buildPrompt: ({ params, template, chunks, classified, company }) =>
    buildDiagnosticoAquisicaoPrompt(params, classified, template, chunks, company),
  generateOp: 'assistant-diagnostico-aquisicao-generate',
  annotation: ({ classified }) => ({
    leaning: classified.leaning,
    kpiCount: classified.kpis.length,
  }),
  paramsForAssembly: (params, company) => ({
    client: company?.company_name ?? '',
    scope: params.descricaoCompra,
    category: params.categoria || params.classificacao,
    deadline: '',
    budget: '',
    criteria: [],
    notes: params.notes ?? '',
  }),
});
