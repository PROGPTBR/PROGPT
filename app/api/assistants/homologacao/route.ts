import { buildAssistantHandler } from '@/lib/assistants/handler';
import { HomologacaoRequestSchema } from '@/lib/assistants/types';
import {
  fetchHomologacaoData,
  buildHomologacaoPrompt,
  type HomologacaoClassified,
} from '@/lib/assistants/homologacao';

export const runtime = 'nodejs';

// POST /api/assistants/homologacao — sub-projeto 36 (fase 1).
// Passo determinístico = consulta fiscal (mcp-fiscal-brasil) pelo CNPJ
// (fail-soft) → narrativa LLM com a persona de homologação/SRM.
export const POST = buildAssistantHandler<
  typeof HomologacaoRequestSchema,
  HomologacaoClassified
>({
  type: 'homologacao',
  requestSchema: HomologacaoRequestSchema,
  traceInput: (parsed) => ({
    templateId: parsed.templateId,
    cnpj: parsed.params.cnpj,
  }),
  classify: {
    spanName: 'fiscal-lookup',
    spanInput: (params) => ({ cnpj: params.cnpj }),
    spanOutput: (c) => ({
      enabled: c.enabled,
      available: c.available,
      hasRisk: !!c.risk,
      hasCompliance: !!c.compliance,
    }),
    run: (params) => fetchHomologacaoData(params),
  },
  buildRetrievalQuery: () =>
    'homologação qualificação de fornecedor due diligence compliance fiscal risco cadastral certidões gestão de risco de suprimento',
  rerankTopN: 6,
  buildPrompt: ({ params, template, chunks, classified, company }) =>
    buildHomologacaoPrompt(params, classified, template, chunks, company),
  generateOp: 'assistant-homologacao-generate',
  annotation: ({ classified }) => ({
    fiscalAvailable: classified.available,
    riskScore: classified.risk?.score ?? null,
  }),
  // Facade RfpParams-shaped para o assembleOutput/renderPlaceholders.
  paramsForAssembly: (params, company) => ({
    client: company?.company_name ?? '',
    scope: `Homologação de ${params.fornecedorNome || params.cnpj}`,
    category: 'Homologação de fornecedor',
    deadline: '',
    budget: '',
    criteria: [],
    notes: params.notas ?? '',
  }),
});
