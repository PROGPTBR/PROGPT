import { buildAssistantHandler } from '@/lib/assistants/handler';
import { PesquisaPrecosRequestSchema } from '@/lib/assistants/types';
import {
  classifyPesquisaPrecos,
  buildPesquisaPrecosPrompt,
  type PesquisaPrecosClassified,
} from '@/lib/assistants/pesquisa-precos';

export const runtime = 'nodejs';

// POST /api/assistants/pesquisa_precos — sub-projeto 37 (fase 1).
// Passo determinístico = resolve cada item no catálogo CATMAT e puxa os preços
// praticados em compras públicas (govdata, fail-soft) → narrativa LLM com a
// persona de pesquisa de preços (mapa de preços, Lei 14.133 art. 23).
export const POST = buildAssistantHandler<
  typeof PesquisaPrecosRequestSchema,
  PesquisaPrecosClassified
>({
  type: 'pesquisa_precos',
  requestSchema: PesquisaPrecosRequestSchema,
  traceInput: (parsed) => ({
    templateId: parsed.templateId,
    titulo: parsed.params.titulo,
    itemCount: parsed.params.itens.length,
  }),
  classify: {
    spanName: 'precos-lookup',
    spanInput: (params) => ({ itemCount: params.itens.length, uf: params.uf ?? 'BR' }),
    spanOutput: (c) => ({
      anyAvailable: c.anyAvailable,
      matched: c.itens.filter((i) => i.match).length,
      priced: c.itens.filter((i) => i.preco?.stats).length,
    }),
    run: (params) => classifyPesquisaPrecos(params),
  },
  buildRetrievalQuery: () =>
    'pesquisa de preços estimativa de custos preço de referência cotação fornecedores benchmark Lei 14.133 should-cost negociação',
  rerankTopN: 6,
  buildPrompt: ({ params, template, chunks, classified, company }) =>
    buildPesquisaPrecosPrompt(params, classified, template, chunks, company),
  generateOp: 'assistant-pesquisa-precos-generate',
  generateMetadata: ({ classified }) => ({
    priced: classified.itens.filter((i) => i.preco?.stats).length,
    items: classified.itens.length,
  }),
  annotation: ({ classified }) => ({
    pricedCount: classified.itens.filter((i) => i.preco?.stats).length,
    itemCount: classified.itens.length,
  }),
  // Facade RfpParams-shaped para o assembleOutput/renderPlaceholders.
  paramsForAssembly: (params, company) => ({
    client: company?.company_name ?? '',
    scope: params.titulo,
    category: 'Pesquisa de preços',
    deadline: '',
    budget: '',
    criteria: [],
    notes: params.notas ?? '',
  }),
});
