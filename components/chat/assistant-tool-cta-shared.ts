import {
  BarChart3,
  Briefcase,
  Coins,
  FileText,
  ImageIcon,
  Landmark,
  Layers,
  LineChart,
  MessageCircle,
  Receipt,
  Scale,
  Star,
  TrendingUp,
  Truck,
  UserCircle2,
} from 'lucide-react';

// Lógica pura (tipos, META, detecção, strip) do card de ferramenta dedicada
// do chat — extraída de AssistantToolCTA.tsx (que é 'use client', pois
// também exporta o componente React) porque `detectAssistantToolCTA` é
// chamada a partir de app/api/chat/route.ts (Route Handler, camada RSC do
// Next.js). Importar qualquer export de um módulo 'use client' de dentro
// dessa camada faz o bundler trocar TODOS os exports — inclusive funções
// puras — por "client references" (objetos opacos, não chamáveis), o que
// quebrava `detectAssistantToolCTA(text) is not a function` em produção
// silenciosamente desde 2026-05-22 (commit cbb3500): o crash acontecia
// dentro do onFinish do streamText, DEPOIS do texto já ter sido enviado ao
// cliente, então a resposta aparecia normal na tela mas followups, resumo
// de título e o flush do trace Langfuse (tudo que vem depois no onFinish)
// nunca rodavam — e o cliente via o toast genérico de erro em toda mensagem
// (stream HTTP fechado incompleto). Este arquivo NÃO tem 'use client': só
// funções/dados puros, sem componente — pode ser importado com segurança
// tanto do client (AssistantToolCTA.tsx, Message.tsx) quanto do server
// (app/api/chat/route.ts).

export type AssistantToolType =
  | 'rfp'
  | 'kraljic'
  | 'porter'
  | 'abc'
  | 'financial'
  | 'scorecard'
  | 'profile'
  | 'negotiation'
  | 'pesquisa_precos'
  | 'spend_analysis'
  | 'indicadores'
  | 'simulador_logistico'
  | 'grafico_rapido'
  | 'comprador'
  | 'simulador_tributario';

export type AssistantToolMeta = {
  title: string;
  blurb: string;
  Icon: typeof FileText;
  // Só necessário quando a rota do assistente NÃO segue o padrão
  // `/assistants/<type>` (ex.: os Simuladores, que vivem em `/simulador*`).
  // Default: `/assistants/${type}`.
  path?: string;
};

export const META: Record<AssistantToolType, AssistantToolMeta> = {
  rfp: {
    title: 'Assistente de RFP / Cotação',
    blurb:
      'Você dá o escopo e os critérios; ele monta o documento da RFP em .docx + planilha de cotação (.xlsx) com as colunas fiscais BR, pronto pra enviar.',
    Icon: FileText,
  },
  kraljic: {
    title: 'Matriz de Kraljic',
    blurb:
      'Classifica suas categorias em estratégico, alavancagem, gargalo e não-crítico — com plano de ação por quadrante e bubble chart.',
    Icon: Layers,
  },
  porter: {
    title: 'Análise das 5 Forças de Porter',
    blurb:
      'Avalia a atratividade do mercado fornecedor por categoria: intensidade de cada força + recomendações práticas.',
    Icon: TrendingUp,
  },
  abc: {
    title: 'Curva ABC do Spend',
    blurb:
      'Aplica Pareto (80/95%) ao seu gasto e entrega plano de ação por classe A/B/C, com gráfico.',
    Icon: BarChart3,
  },
  financial: {
    title: 'Análise Financeira do Fornecedor',
    blurb:
      'Score 0–100 de saúde financeira a partir de 12 indicadores (liquidez, endividamento, margem, rentabilidade).',
    Icon: Briefcase,
  },
  scorecard: {
    title: 'Supplier Scorecard',
    blurb:
      'Pontua e ranqueia seus fornecedores por critérios ponderados (0–100), classifica em estratégico / desenvolvimento / saída e gera ranking + planilha.',
    Icon: Star,
  },
  profile: {
    title: 'Perfil da Categoria',
    blurb:
      'Caracteriza uma categoria de compra (15 campos) para servir de contexto aos outros assistentes.',
    Icon: UserCircle2,
  },
  negotiation: {
    title: 'Simulador de Negociação',
    blurb:
      'Monta a estratégia (BATNA, SWOT, metas SMART) e simula a negociação com a IA no papel do fornecedor — com score no final.',
    Icon: MessageCircle,
  },
  pesquisa_precos: {
    title: 'Pesquisa de Preços',
    blurb:
      'Descreva os itens e ele busca o preço de referência nas compras públicas (CATMAT / Painel de Preços) — mediana, faixa e fontes para ancorar RFP, custo e negociação.',
    Icon: Coins,
  },
  spend_analysis: {
    title: 'Análise de Gastos (Spend Analysis)',
    blurb:
      'Suba um lote de invoices (PDF ou planilha) e ele extrai cada nota, classifica por categoria, converte moedas e entrega base classificada + KPIs + plano de strategic sourcing.',
    Icon: Receipt,
  },
  indicadores: {
    title: 'Indicadores Econômicos',
    blurb:
      'Painel ao vivo do Banco Central (Selic, CDI, IPCA, IGP-M, dólar, euro) com gráfico e leitura para compras — custo de capital, reajuste contratual e câmbio.',
    Icon: LineChart,
  },
  simulador_logistico: {
    title: 'Simulador Logístico (DIFAL)',
    blurb:
      'Calcula o DIFAL (diferencial de alíquota do ICMS) de uma compra interestadual e compara o custo total entre diferentes UFs de origem.',
    Icon: Truck,
    path: '/simulador-logistico',
  },
  grafico_rapido: {
    title: 'Gráfico Rápido',
    blurb:
      'Cole uma tabela de dados (ou suba uma planilha CSV/XLSX) e receba um gráfico pronto pra baixar e inserir em qualquer documento ou apresentação.',
    Icon: ImageIcon,
  },
  comprador: {
    title: 'Equalizador de Propostas',
    blurb:
      'Chegaram as cotações? Jogue as propostas dos fornecedores aqui: ele compara por TCO (preço + frete + impostos), aponta quem não atende a política ou está fora do padrão, e já monta o rascunho do Pedido de Compra.',
    Icon: Scale,
  },
  simulador_tributario: {
    title: 'Simulador Tributário',
    blurb:
      'Compare o Simples Nacional com o novo modelo da Reforma Tributária (IBS/CBS) — carga tributária e impacto no status contábil, com consulta de CNPJ pra preencher os dados.',
    Icon: Landmark,
    path: '/simulador',
  },
};

export function pathFor(type: AssistantToolType): string {
  return META[type]?.path ?? `/assistants/${type}`;
}

const VALID_TYPES = new Set<AssistantToolType>([
  'rfp',
  'kraljic',
  'porter',
  'abc',
  'financial',
  'scorecard',
  'profile',
  'negotiation',
  'pesquisa_precos',
  'spend_analysis',
  'indicadores',
  'simulador_logistico',
  'grafico_rapido',
  'comprador',
  'simulador_tributario',
]);

// Tipos cuja rota NÃO segue `/assistants/<type>` (ver `path` em META) —
// precisam de detecção/strip à parte, já que o regex principal só reconhece
// o prefixo `/assistants/`.
const CUSTOM_PATH_TYPES = (Object.keys(META) as AssistantToolType[]).filter(
  (t) => META[t].path,
);
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const CUSTOM_PATH_ALTERNATION = CUSTOM_PATH_TYPES.map((t) =>
  escapeRegExp(META[t].path!),
).join('|');

// Server- and client-callable detector. Procura a PRIMEIRA menção — um
// `/assistants/<type>` canônico OU uma das rotas custom acima (ex.:
// `/simulador-logistico`) — no texto da resposta do LLM. Retorna null se não
// achar nada ou se achar `suppliers` (que tem CTA próprio via
// supplier_search intent).
export function detectAssistantToolCTA(text: string): AssistantToolType | null {
  const re = CUSTOM_PATH_ALTERNATION
    ? new RegExp(
        `/assistants/([a-z][a-z0-9_-]*)\\b|(${CUSTOM_PATH_ALTERNATION})\\b`,
        'i',
      )
    : /\/assistants\/([a-z][a-z0-9_-]*)\b/i;
  const m = text.match(re);
  if (!m) return null;

  if (m[2]) {
    const found = CUSTOM_PATH_TYPES.find(
      (t) => META[t].path!.toLowerCase() === m[2]!.toLowerCase(),
    );
    return found ?? null;
  }

  const candidate = m[1]!.toLowerCase() as AssistantToolType;
  if (candidate === ('suppliers' as AssistantToolType)) return null;
  if (!VALID_TYPES.has(candidate)) return null;
  return candidate;
}

// Tipos cujo caminho cru removemos do texto exibido (o card assume o CTA).
// Inclui `suppliers` (caminho válido) pra não deixar o path feio na frase.
const STRIP_TYPES =
  'rfp|kraljic|porter|abc|financial|scorecard|profile|negotiation|homologacao|pesquisa_precos|spend_analysis|indicadores|grafico_rapido|comprador|suppliers';
const ASSISTANTS_OR_CUSTOM = CUSTOM_PATH_ALTERNATION
  ? `/assistants/(?:${STRIP_TYPES})|${CUSTOM_PATH_ALTERNATION}`
  : `/assistants/(?:${STRIP_TYPES})`;
// "...em /assistants/rfp" (ou "...em /simulador-logistico") → remove a
// preposição + o caminho, deixando a frase natural ("use a ferramenta
// dedicada — ela gera...").
const STRIP_PREP_RE = new RegExp(
  `\\s+(?:em|no|na|via|in|at)\\s+(?:${ASSISTANTS_OR_CUSTOM})\\b`,
  'gi',
);
// Qualquer caminho cru remanescente.
const STRIP_BARE_RE = new RegExp(`(?:${ASSISTANTS_OR_CUSTOM})\\b`, 'gi');

export function stripAssistantPaths(md: string): string {
  return md
    .replace(STRIP_PREP_RE, '')
    .replace(STRIP_BARE_RE, '')
    .replace(/ {2,}/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1')
    .trim();
}
