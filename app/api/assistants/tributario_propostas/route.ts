import { z } from 'zod';
import { buildAssistantHandler } from '@/lib/assistants/handler';
import { ParametrosTributariosSchema, analisarPropostas, type AnaliseTributaria } from '@/lib/tributario/calculo';
import { buildTributarioPrompt } from '@/lib/tributario/prompt';

export const runtime = 'nodejs';

const RequestSchema = z.object({
  templateId: z.string().uuid(),
  params: ParametrosTributariosSchema,
});

// POST /api/assistants/tributario_propostas: custo líquido de impostos por
// proposta, hoje e na transição da reforma (cálculo determinístico em
// lib/tributario/calculo.ts) + relatório do LLM. Ciclo de vida compartilhado
// em lib/assistants/handler.ts.
export const POST = buildAssistantHandler<typeof RequestSchema, AnaliseTributaria>({
  type: 'tributario_propostas',
  requestSchema: RequestSchema,
  traceInput: (parsed) => ({
    templateId: parsed.templateId,
    regimeComprador: parsed.params.regimeComprador,
    destinacao: parsed.params.destinacao,
    propostas: parsed.params.propostas.length,
  }),
  classify: {
    spanName: 'calculo-tributario',
    spanOutput: (a) => ({
      melhorHoje: a.melhorPorCenario.atual,
      melhor2033: a.melhorPorCenario['2033'],
      virada: a.viradaNaReforma,
    }),
    run: (params) => analisarPropostas(params),
  },
  buildRetrievalQuery: (params) =>
    `tributação compras crédito ICMS PIS Cofins reforma tributária IBS CBS custo total TCO ${params.descricaoCompra}`.slice(0, 400),
  rerankTopN: 5,
  buildPrompt: ({ params, template, chunks, classified, company }) =>
    buildTributarioPrompt(params, classified, template, chunks, company),
  generateOp: 'assistant-tributario-generate',
  generateMetadata: ({ params, classified }) => ({
    propostas: params.propostas.length,
    virada: classified.viradaNaReforma,
  }),
  annotation: ({ classified }) => ({ viradaNaReforma: classified.viradaNaReforma }),
  paramsForAssembly: (params, company) => ({
    client: company?.company_name ?? '',
    scope: params.descricaoCompra,
    category: '',
    deadline: '',
    budget: '',
    criteria: [],
    notes: params.notes,
  }),
});
