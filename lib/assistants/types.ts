import { z } from 'zod';

// Sub-projeto 20 — Assistentes (v1: RFP)
//
// AssistantType is the discriminator for everything in this feature:
// templates.assistant_type, assistant_runs.assistant_type, API route paths.
// Adding 'spec' or 'quote-analysis' in the future requires updating:
//   1. this union
//   2. the templates CHECK constraint (new migration)
//   3. ApiOperation in lib/observability/api-usage.ts
//   4. add /api/assistants/<type>/route.ts + UI page
export type AssistantType =
  | 'rfp'
  | 'kraljic'
  | 'porter'
  | 'financial'
  | 'abc'
  | 'profile'
  | 'negotiation'
  | 'scorecard'
  | 'homologacao';

export const ASSISTANT_TYPES = [
  'rfp',
  'kraljic',
  'porter',
  'financial',
  'abc',
  'profile',
  'negotiation',
  'scorecard',
  'homologacao',
] as const;

export type ThemeStatusRow = 'running' | 'done' | 'error';

// ── Template row shape (DB serialization) ────────────────────────────────
export type TemplateRow = {
  id: string;
  assistant_type: AssistantType;
  name: string;
  description: string | null;
  body_md: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// Body limits: templates with placeholders typically run 3-30 KB. A 200 KB
// cap is generous and keeps a malformed admin upload from filling the
// prompt context window.
export const TEMPLATE_BODY_MAX = 200_000;
export const TEMPLATE_NAME_MAX = 120;
export const TEMPLATE_DESCRIPTION_MAX = 500;

export const TemplateCreateSchema = z.object({
  assistant_type: z.enum(ASSISTANT_TYPES),
  name: z.string().trim().min(1).max(TEMPLATE_NAME_MAX),
  description: z.string().trim().max(TEMPLATE_DESCRIPTION_MAX).optional().nullable(),
  body_md: z.string().min(1).max(TEMPLATE_BODY_MAX),
});

export const TemplatePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(TEMPLATE_NAME_MAX).optional(),
    description: z.string().trim().max(TEMPLATE_DESCRIPTION_MAX).nullable().optional(),
    body_md: z.string().min(1).max(TEMPLATE_BODY_MAX).optional(),
  })
  .refine((b) => b.name !== undefined || b.description !== undefined || b.body_md !== undefined, {
    message: 'at least one field required',
  });

// ── RFP params (form input) ──────────────────────────────────────────────
// Tight constraints so we don't waste tokens on a 5000-char "scope" field.
// The form enforces these client-side; the API revalidates server-side.
export const RfpParamsSchema = z.object({
  // Empresa contratante (comprador). Aparece em ~12 pontos do template RFQ
  // como "padrões da [INSERIR NOME CLIENTE]" / "estratégias da [INSERIR NOME
  // CLIENTE]". Sem este campo o LLM ou inventa nome ou deixa placeholder
  // (violando a regra "NÃO deixe placeholders no output final").
  client: z.string().trim().min(2).max(200),
  scope: z.string().trim().min(10).max(1000),
  category: z.string().trim().min(2).max(200),
  deadline: z.string().trim().min(1).max(100), // free-text "30 dias", "2026-06-15", etc.
  budget: z.string().trim().min(1).max(200),
  // Free-form list of selection criteria. Multi-select in the UI converts to
  // string[] before sending. Empty array is OK — model defaults to standard.
  criteria: z.array(z.string().trim().min(1).max(80)).max(20),
  notes: z.string().trim().max(2000).optional().default(''),
  // Sub-projeto 33: when the user invokes "Iniciar de um Perfil" in the
  // form, the UUID of the source Profile run is stored here for cross-
  // referencing. Optional and JSONB — no migration needed.
  perfilId: z.string().uuid().optional(),
});

export type RfpParams = z.infer<typeof RfpParamsSchema>;

// Request body for POST /api/assistants/rfp
export const RfpRequestSchema = z.object({
  templateId: z.string().uuid(),
  params: RfpParamsSchema,
});

export type RfpRequest = z.infer<typeof RfpRequestSchema>;

// ── Kraljic params (form input) ──────────────────────────────────────────
// Sub-projeto 27 — Matriz de Kraljic.
//
// Methodology mirrors the Procurement Garage template:
//   - Eixo Y (Impacto no Negócio): 4 critérios escala 1-4
//   - Eixo X (Complexidade Mercado Fornecedor): 4 critérios escala 1-4
//   - Spend é input numérico (R$ MM); score derivado server-side via
//     percentil dentro do portfólio (top 25%→4, 25-50%→3, 50-75%→2,
//     bottom 25%→1).
// The user therefore scores 7 sub-criteria per item (3 of Impacto +
// 4 of Complexidade); Spend is the 4th Impacto criterion but
// computed, not scored.

const Score1to4 = z.number().int().min(1).max(4);

export const KraljicItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  segment: z.string().trim().max(120).optional().default(''),
  category: z.string().trim().max(120).optional().default(''),
  spendMM: z.number().min(0).max(1_000_000), // R$ MM, derived to score
  // Impacto no Negócio (Y axis) — 3 user-scored criteria
  criticality: Score1to4, // Nível de Criticidade
  technicalSpec: Score1to4, // Especificações Técnicas
  customerValue: Score1to4, // Valor Percebido pelo Cliente Final
  // Complexidade Mercado Fornecedor (X axis) — 4 user-scored criteria
  marketStructure: Score1to4, // Estrutura do Mercado
  marketRivalry: Score1to4, // Rivalidade do Mercado
  supplierPower: Score1to4, // Poder de Barganha do Fornecedor
  supplierSwitching: Score1to4, // Substituição de Fornecedor
});

export type KraljicItem = z.infer<typeof KraljicItemSchema>;

export const KraljicParamsSchema = z.object({
  portfolioName: z.string().trim().min(1).max(200),
  // Período da análise. Free-text: "2026 Q2", "Jan-Jun 2026", "Ano fiscal 2025", etc.
  analysisPeriod: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
  items: z.array(KraljicItemSchema).min(2).max(200),
  perfilId: z.string().uuid().optional(),
});

export type KraljicParams = z.infer<typeof KraljicParamsSchema>;

export const KraljicRequestSchema = z.object({
  templateId: z.string().uuid(),
  params: KraljicParamsSchema,
});

export type KraljicRequest = z.infer<typeof KraljicRequestSchema>;

export type KraljicQuadrant = 'estrategico' | 'alavancavel' | 'gargalo' | 'nao-critico';

export const KRALJIC_QUADRANT_LABELS: Record<KraljicQuadrant, string> = {
  estrategico: 'Estratégico',
  alavancavel: 'Alavancável',
  gargalo: 'Gargalo',
  'nao-critico': 'Não Crítico',
};

export type ClassifiedKraljicItem = KraljicItem & {
  spendShare: number; // 0-1
  spendScore: 1 | 2 | 3 | 4; // derived from percentile within portfolio
  businessImpact: number; // weighted, 1-4 domain
  supplyComplexity: number; // weighted, 1-4 domain
  quadrant: KraljicQuadrant;
};

// ── Porter 5 Forces params (form input) ──────────────────────────────────
// Sub-projeto 29 — Análise das 5 Forças de Porter (1979).
//
// Conceptual analysis, not data-entry. The user picks a category +
// segmento and the LLM generates the full structured analysis grounded
// in canonical sources (Porter 1979, 1985; Cox 1996 for buyer power
// reframing). No deterministic component — pure prompt + retrieval.

// Cada uma das 35 afirmações canônicas (ver lib/assistants/porter-
// statements.ts) é pontuada pelo usuário com:
//   weight (0-3)  — relevância da afirmação no setor em análise
//   score  (1-5)  — quão verdadeira ela é hoje
// O servidor calcula a média ponderada por força (Σ w*s / Σ w) e
// converte em intensidade (baixa < 2 ≤ média < 3.5 ≤ alta).
export const PorterStatementScoreSchema = z.object({
  id: z.string().regex(/^S[1-5]-\d{1,2}$/),
  weight: z.number().int().min(0).max(3),
  score: z.number().int().min(1).max(5),
});

export type PorterStatementScore = z.infer<typeof PorterStatementScoreSchema>;

export const PorterParamsSchema = z.object({
  categoria: z.string().trim().min(2).max(200),
  segmento: z.string().trim().max(200).optional().default(''),
  // Escopo geográfico ou de mercado (Brasil, América Latina, global,
  // nicho específico). Free-text para preservar a riqueza da análise.
  escopo: z.string().trim().max(300).optional().default(''),
  // Observações adicionais do comprador (contexto da empresa, dados
  // de share, restrições). Vai pro prompt como contexto extra.
  observacoes: z.string().trim().max(2000).optional().default(''),
  // 35 statement scorings — see lib/assistants/porter-statements.ts.
  // Min 35 / max 35 enforced loosely (>=5 to allow lighter UIs in v2).
  // Order doesn't matter; classifyPorterForces() groups by `id` prefix.
  statements: z.array(PorterStatementScoreSchema).min(5).max(35),
  perfilId: z.string().uuid().optional(),
});

export type PorterParams = z.infer<typeof PorterParamsSchema>;

export const PorterRequestSchema = z.object({
  templateId: z.string().uuid(),
  params: PorterParamsSchema,
});

export type PorterRequest = z.infer<typeof PorterRequestSchema>;

// As 5 forças canônicas + classificação de intensidade.
export type PorterForce =
  | 'rivalidade'
  | 'novos-entrantes'
  | 'substitutos'
  | 'poder-fornecedor'
  | 'poder-comprador';

export const PORTER_FORCE_LABELS: Record<PorterForce, string> = {
  rivalidade: 'Rivalidade entre concorrentes',
  'novos-entrantes': 'Ameaça de novos entrantes',
  substitutos: 'Ameaça de produtos substitutos',
  'poder-fornecedor': 'Poder de barganha dos fornecedores',
  'poder-comprador': 'Poder de barganha dos compradores',
};

// ── Financial Health Analyzer params (form input) ────────────────────────
// Sub-projeto 30 — Análise financeira de fornecedor.
//
// Os 12 indicadores canônicos seguem o template "Buyer Financial Health".
// Cada um é opcional individualmente (form aceita parcial), mas os 4
// pilares de scoring (liquidez, dívida/EBITDA, margem EBITDA, ROE)
// precisam estar preenchidos para o cálculo determinístico produzir
// um score.

export const FinancialIndicatorsSchema = z.object({
  // Demonstrativo de Resultado (DRE)
  receitaLiquida: z.number().optional(), // R$ MM
  ebitda: z.number().optional(), // R$ MM
  lucroLiquido: z.number().optional(), // R$ MM
  // Margens (%)
  margemLiquidaPct: z.number().optional(),
  margemEbitdaPct: z.number().optional(),
  // Endividamento
  dividaLiquidaEbitda: z.number().optional(), // x EBITDA
  endividamentoGeralPct: z.number().optional(),
  // Balanço
  liquidezCorrente: z.number().optional(),
  patrimonioLiquido: z.number().optional(), // R$ MM
  // Rentabilidade (%)
  roePct: z.number().optional(),
  roicPct: z.number().optional(),
  // Caixa
  fluxoCaixaOperacional: z.number().optional(), // R$ MM
});

export type FinancialIndicators = z.infer<typeof FinancialIndicatorsSchema>;

export const FinancialParamsSchema = z.object({
  supplierName: z.string().trim().min(2).max(200),
  cnpj: z.string().trim().max(32).optional().default(''),
  referenceYear: z.string().trim().max(20).optional().default(''),
  observacoes: z.string().trim().max(2000).optional().default(''),
  indicators: FinancialIndicatorsSchema,
  perfilId: z.string().uuid().optional(),
});

export type FinancialParams = z.infer<typeof FinancialParamsSchema>;

export const FinancialRequestSchema = z.object({
  templateId: z.string().uuid(),
  params: FinancialParamsSchema,
});

export type FinancialRequest = z.infer<typeof FinancialRequestSchema>;

// Recommendation discriminants used in the prompt + scorecard UI.
export type FinancialRating = 'excellent' | 'good' | 'caution' | 'poor';
export type FinancialRecommendation = 'buy' | 'caution' | 'do_not_buy';

export const FINANCIAL_RATING_LABELS: Record<FinancialRating, string> = {
  excellent: 'Excelente',
  good: 'Bom',
  caution: 'Cuidado',
  poor: 'Crítico',
};

export const FINANCIAL_RECOMMENDATION_LABELS: Record<
  FinancialRecommendation,
  string
> = {
  buy: 'Recomendado contratar',
  caution: 'Contratar com cautela',
  do_not_buy: 'Não recomendado',
};

// ── ABC Curve (Spend Analysis) params ────────────────────────────────────
// Sub-projeto 31 — Análise ABC (curva de Pareto sobre spend).
//
// Cada item é uma transação de compra com nome + valor. O sistema:
//   1. Soma o spend por item (consolida duplicatas opcionalmente)
//   2. Ordena descendente
//   3. Calcula % de cada item e % cumulativo
//   4. Classifica:
//        A = items até 80% do cumulativo (poucos itens, muito valor)
//        B = 80% < cum ≤ 95%
//        C = cum > 95% (muitos itens, pouco valor)
//
// LLM gera: plano de ação por classe + análise de concentração + insights
// de oportunidade (top spend, fornecedor único, etc.).

export const AbcItemSchema = z.object({
  name: z.string().trim().min(1).max(300),
  supplier: z.string().trim().max(200).optional().default(''),
  category: z.string().trim().max(200).optional().default(''),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().trim().max(20).optional().default(''),
  spend: z.number().nonnegative(), // R$ (não MM — itens individuais podem ser pequenos)
});

export type AbcItem = z.infer<typeof AbcItemSchema>;

export const AbcParamsSchema = z.object({
  analysisName: z.string().trim().min(1).max(200),
  analysisPeriod: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
  // Whether to consolidate items by (name) before classifying. Default
  // true — a typical spend export has the same SKU appearing across many
  // POs and the user expects A/B/C per SKU, not per PO line.
  consolidate: z.boolean().optional().default(true),
  items: z.array(AbcItemSchema).min(5).max(5000),
  perfilId: z.string().uuid().optional(),
});

export type AbcParams = z.infer<typeof AbcParamsSchema>;

export const AbcRequestSchema = z.object({
  templateId: z.string().uuid(),
  params: AbcParamsSchema,
});

export type AbcRequest = z.infer<typeof AbcRequestSchema>;

export type AbcClass = 'A' | 'B' | 'C';

export const ABC_CLASS_LABELS: Record<AbcClass, string> = {
  A: 'A — alta importância',
  B: 'B — importância média',
  C: 'C — baixa importância',
};

export type ClassifiedAbcItem = {
  name: string;
  supplier: string;
  category: string;
  quantity?: number;
  unit: string;
  spend: number;
  rank: number; // 1 = highest spend
  share: number; // 0-1
  cumulativeShare: number; // 0-1
  abcClass: AbcClass;
};

export type AbcClassSummary = {
  count: number;
  totalSpend: number;
  spendShare: number; // 0-1
  itemShare: number; // 0-1 (% de items)
};

export type AbcAnalysis = {
  items: ClassifiedAbcItem[];
  totalSpend: number;
  totalItems: number;
  byClass: Record<AbcClass, AbcClassSummary>;
};

// ── Sub-projeto 33 — Profile (Perfil da Categoria) ──────────────────────────
// First step of Strategic Sourcing: characterize the category before any
// downstream analysis. Output is purely narrative (no deterministic
// scoring like Kraljic/ABC/Financial). 15 structured fields in 5 blocks.
// The integration value comes from the per-form "Iniciar de um Perfil"
// picker which reads these params and pre-populates downstream assistants.

export const ProfileStakeholderSchema = z.object({
  nome: z.string().trim().min(1).max(100),
  papel: z.enum(['usuario', 'aprovador', 'operacao']),
});

export type ProfileStakeholder = z.infer<typeof ProfileStakeholderSchema>;

export const PROFILE_PRIORITY_VALUES = [
  'custo',
  'qualidade',
  'inovacao',
  'sustentabilidade',
] as const;

export type ProfilePriority = (typeof PROFILE_PRIORITY_VALUES)[number];

export const ProfileParamsSchema = z.object({
  // Identificação (R)
  nomeCategoria: z.string().trim().min(1).max(200),
  descricao: z.string().trim().min(1).max(2000),
  subSegmentos: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  escopoIncluido: z.string().trim().min(1).max(2000),
  escopoNaoIncluido: z.string().trim().max(2000).optional().default(''),

  // Volume e mercado (O)
  spendAnualBRL: z.number().nonnegative().optional(),
  volumeFisico: z.string().trim().max(120).optional().default(''),
  numeroFornecedoresAtivos: z.number().int().nonnegative().optional(),
  sazonalidade: z.string().trim().max(300).optional().default(''),

  // Critérios técnicos
  requisitosTecnicos: z.string().trim().min(1).max(3000),
  restricoesRegulatorias: z.string().trim().max(2000).optional().default(''),
  criteriosAvaliacao: z.array(z.string().trim().min(1).max(200)).min(1).max(10),

  // Stakeholders (R)
  stakeholders: z.array(ProfileStakeholderSchema).min(1).max(20),

  // Prioridade (R)
  prioridadeEstrategica: z.enum(PROFILE_PRIORITY_VALUES),
  observacoes: z.string().trim().max(2000).optional().default(''),
  // Sub-projeto 33: reserved for a future "Perfil derivado de outro
  // Perfil" feature. Optional + JSONB — no migration needed.
  perfilId: z.string().uuid().optional(),
});

export type ProfileParams = z.infer<typeof ProfileParamsSchema>;

export const ProfileRequestSchema = z.object({
  templateId: z.string().uuid(),
  params: ProfileParamsSchema,
});

export type ProfileRequest = z.infer<typeof ProfileRequestSchema>;

// PartialProfile: shape returned by the multimodal extractor. Every field
// is optional and stakeholders may be empty (caller revisa antes do submit).
export const PartialProfileSchema = z.object({
  nomeCategoria: z.string().trim().max(200).optional(),
  descricao: z.string().trim().max(2000).optional(),
  subSegmentos: z.array(z.string().trim().max(120)).max(20).optional(),
  escopoIncluido: z.string().trim().max(2000).optional(),
  escopoNaoIncluido: z.string().trim().max(2000).optional(),
  spendAnualBRL: z.number().nonnegative().optional(),
  volumeFisico: z.string().trim().max(120).optional(),
  numeroFornecedoresAtivos: z.number().int().nonnegative().optional(),
  sazonalidade: z.string().trim().max(300).optional(),
  requisitosTecnicos: z.string().trim().max(3000).optional(),
  restricoesRegulatorias: z.string().trim().max(2000).optional(),
  criteriosAvaliacao: z.array(z.string().trim().max(200)).max(10).optional(),
  stakeholders: z.array(ProfileStakeholderSchema).max(20).optional(),
  prioridadeEstrategica: z.enum(PROFILE_PRIORITY_VALUES).optional(),
  observacoes: z.string().trim().max(2000).optional(),
});

export type PartialProfile = z.infer<typeof PartialProfileSchema>;

// ── Sub-projeto 22 — Negotiation (Strategic Sourcing Step 6) ─────────────
//
// Dois modos em UM run:
//   1. Strategy Builder (form one-shot): gera JSON estruturado com postura,
//      Kraljic, SWOT, Metas SMART, Inteligência de Mercado, Sumário.
//   2. Text Simulator (chat multi-turno): LLM personifica o fornecedor com
//      a estratégia carregada como contexto. Encerra com transcript + score.
//
// O run vive por todo o ciclo: strategy é gerada → opcionalmente o user
// inicia simulação → transcript cresce turno-a-turno → score é gerado ao
// encerrar. Tudo no mesmo `assistant_runs` row.

const PORTER_LEVEL = z.enum(['low', 'med', 'high']);
export type PorterLevel = z.infer<typeof PORTER_LEVEL>;

// Posição de mercado do fornecedor — dropdown da Tela 1 do Deal Sim.
export const SUPPLIER_MARKET_POSITION = [
  'lider',
  'desafiante',
  'seguidor',
  'nicho',
  'novato',
] as const;
export type SupplierMarketPosition =
  (typeof SUPPLIER_MARKET_POSITION)[number];

export const SUPPLIER_MARKET_POSITION_LABELS: Record<
  SupplierMarketPosition,
  string
> = {
  lider: 'Líder de mercado',
  desafiante: 'Desafiante',
  seguidor: 'Seguidor',
  nicho: 'Player de nicho',
  novato: 'Novato / startup',
};

// Objetivo estratégico — dropdown OBJETIVOS E RELACIONAMENTO.
export const NEGOTIATION_OBJECTIVE = [
  'reducao-custos',
  'redução-risco',
  'aumento-qualidade',
  'parceria-longo-prazo',
  'diversificacao',
  'sustentabilidade',
  'inovacao',
] as const;
export type NegotiationObjective = (typeof NEGOTIATION_OBJECTIVE)[number];

export const NEGOTIATION_OBJECTIVE_LABELS: Record<
  NegotiationObjective,
  string
> = {
  'reducao-custos': 'Redução de custos',
  'redução-risco': 'Redução de risco',
  'aumento-qualidade': 'Aumento de qualidade',
  'parceria-longo-prazo': 'Parceria de longo prazo',
  diversificacao: 'Diversificação',
  sustentabilidade: 'Sustentabilidade',
  inovacao: 'Inovação',
};

// Kraljic dropdown — reaproveita os labels do KraljicQuadrant.
export const KRALJIC_QUADRANT_VALUES: KraljicQuadrant[] = [
  'estrategico',
  'alavancavel',
  'gargalo',
  'nao-critico',
];

// Strategy Builder params (form input — Tela 1-2 do Deal Sim).
export const NegotiationStrategyParamsSchema = z.object({
  // Identificação
  supplierName: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(200),
  supplierWebsite: z.string().trim().max(300).optional().default(''),

  // Contexto comercial
  annualSpend: z.string().trim().max(120).optional().default(''), // free-text "R$ 4,5MM", "R$ 100k", etc.
  supplierShare: z.string().trim().max(60).optional().default(''), // "70%", "30-40%"
  marketPosition: z.enum(SUPPLIER_MARKET_POSITION).optional(),
  kraljicQuadrant: z
    .enum(['estrategico', 'alavancavel', 'gargalo', 'nao-critico'])
    .optional(),

  // ZOPA & Parâmetros Financeiros (free-text — formatos brasileiros variados)
  currentPrice: z.string().trim().max(120).optional().default(''),
  supplierDesiredPrice: z.string().trim().max(120).optional().default(''),
  targetPrice: z.string().trim().max(120).optional().default(''),
  walkawayPrice: z.string().trim().max(120).optional().default(''),

  // Objetivos e relacionamento
  strategicObjective: z.enum(NEGOTIATION_OBJECTIVE).optional(),
  contractStatus: z.string().trim().max(2000).optional().default(''),
  priceScenario: z.string().trim().max(2000).optional().default(''),

  // Link opcional a um Perfil (sub-projeto 33).
  perfilId: z.string().uuid().optional(),
});

export type NegotiationStrategyParams = z.infer<
  typeof NegotiationStrategyParamsSchema
>;

// Output do Strategy Builder — JSON renderizado como cards visuais.
// Mantemos texto longo em strings; arrays de bullets são string[].
export const NegotiationStrategyResultSchema = z.object({
  // Banner principal (Tela 3 — "Colaborativa-Assertiva.")
  posture: z.object({
    label: z.string().trim().min(1).max(120), // ex: "Colaborativa-Assertiva"
    paragraph: z.string().trim().min(1).max(3000), // bloco em itálico do banner
  }),
  // Cards de poder de barganha (3 níveis)
  bargainingPower: z.object({
    buyer: PORTER_LEVEL,
    supplier: PORTER_LEVEL,
  }),
  // Card quadrante Kraljic (label + explicação narrativa)
  kraljic: z.object({
    quadrant: z.enum([
      'estrategico',
      'alavancavel',
      'gargalo',
      'nao-critico',
    ]),
    label: z.string().trim().min(1).max(120),
    explanation: z.string().trim().min(1).max(2000),
  }),
  // Inteligência de Mercado (Tela 4 — 5 cards)
  marketIntel: z.object({
    news: z.string().trim().max(2000),
    financials: z.string().trim().max(2000),
    innovations: z.string().trim().max(2000),
    risks: z.string().trim().max(2000),
    sustainability: z.string().trim().max(2000),
  }),
  // Sumário Executivo (Tela 5)
  executiveSummary: z.string().trim().min(1).max(5000),
  // SWOT (4 cards de bullets)
  swot: z.object({
    strengths: z.array(z.string().trim().min(1).max(300)).max(8),
    weaknesses: z.array(z.string().trim().min(1).max(300)).max(8),
    opportunities: z.array(z.string().trim().min(1).max(300)).max(8),
    threats: z.array(z.string().trim().min(1).max(300)).max(8),
  }),
  // Metas SMART da Missão
  smartGoals: z.object({
    specific: z.string().trim().min(1).max(1000),
    measurable: z.string().trim().min(1).max(1000),
    achievable: z.string().trim().min(1).max(1000),
    relevant: z.string().trim().min(1).max(1000),
    temporal: z.string().trim().min(1).max(1000),
  }),
});

export type NegotiationStrategyResult = z.infer<
  typeof NegotiationStrategyResultSchema
>;

// Request body do POST /api/assistants/negotiation/strategy
export const NegotiationStrategyRequestSchema = z.object({
  params: NegotiationStrategyParamsSchema,
});
export type NegotiationStrategyRequest = z.infer<
  typeof NegotiationStrategyRequestSchema
>;

// Setup da simulação (Tela 6 — depende de strategy já gerada).
export const NEGOTIATION_PERSONA_PROFILE = [
  'agressivo',
  'colaborativo',
  'pragmatico',
  'rigido',
  'relacional',
] as const;
export type NegotiationPersonaProfile =
  (typeof NEGOTIATION_PERSONA_PROFILE)[number];

export const NEGOTIATION_PERSONA_PROFILE_LABELS: Record<
  NegotiationPersonaProfile,
  string
> = {
  agressivo: 'Agressivo — pressiona, ancora alto, raramente cede',
  colaborativo: 'Colaborativo — busca ganha-ganha, mas firme em interesses',
  pragmatico: 'Pragmático — orientado a fechar, troca rapidamente',
  rigido: 'Rígido — fixo no script, fala-padrão, evita exceções',
  relacional: 'Relacional — joga longo prazo, sensível à confiança',
};

export const NegotiationSimulatorSetupSchema = z.object({
  personaProfile: z.enum(NEGOTIATION_PERSONA_PROFILE),
  supplierObjectives: z.string().trim().min(1).max(2000),
  supplierWalkaway: z.string().trim().min(1).max(2000),
});
export type NegotiationSimulatorSetup = z.infer<
  typeof NegotiationSimulatorSetupSchema
>;

// Turno no chat. Stateless por turno; client mantém histórico.
// Max 16000: uma mensagem pode embutir um contrato/proposta anexado
// (<anexo>, parse capado em 8000 chars) + a pergunta do comprador (sub-projeto 34).
export const NegotiationTurnRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(16000),
      }),
    )
    .min(1)
    .max(100),
});
export type NegotiationTurnRequest = z.infer<
  typeof NegotiationTurnRequestSchema
>;

// Score do simulator (gerado em /close).
export const NegotiationScoreSchema = z.object({
  overall: z.number().int().min(0).max(100),
  dimensions: z.object({
    anchoring: z.number().int().min(0).max(100),
    concessions: z.number().int().min(0).max(100),
    batna: z.number().int().min(0).max(100),
    closing: z.number().int().min(0).max(100),
  }),
  strengths: z.array(z.string().trim().min(1).max(400)).max(8),
  weaknesses: z.array(z.string().trim().min(1).max(400)).max(8),
  recommendations: z.array(z.string().trim().min(1).max(400)).max(8),
});
export type NegotiationScore = z.infer<typeof NegotiationScoreSchema>;

// Transcript JSONB serialization.
export const NegotiationTranscriptTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
  ts: z.string().datetime().optional(),
});
export type NegotiationTranscriptTurn = z.infer<
  typeof NegotiationTranscriptTurnSchema
>;

// ── Assistant run row shape (DB serialization) ───────────────────────────
// `params` is discriminated by `assistant_type`. We type it as the union
// here and narrow at the call site.
export type AssistantRunRow = {
  id: string;
  user_id: string;
  assistant_type: AssistantType;
  template_id: string | null;
  params:
    | RfpParams
    | KraljicParams
    | PorterParams
    | FinancialParams
    | AbcParams
    | ProfileParams
    | NegotiationStrategyParams
    | ScorecardParams
    | HomologacaoParams;
  output_md: string | null;
  status: ThemeStatusRow;
  error_message: string | null;
  trace_id: string | null;
  created_at: string;
  finished_at: string | null;
  // Sub-projeto 22 — negociação. Populated quando assistant_type='negotiation'.
  strategy?: NegotiationStrategyResult | null;
  transcript?: NegotiationTranscriptTurn[] | null;
  score?: NegotiationScore | null;
  // Item 6 do roadmap — histórico persistido do refine-chat (qualquer tipo).
  refine_messages?: RefineMessage[] | null;
};

// Uma mensagem do refine-chat persistido (item 6 do roadmap).
export type RefineMessage = {
  role: 'user' | 'assistant';
  content: string;
  ts?: string;
};

// ── Supplier Scorecard (Strategic Sourcing step 8) ───────────────────────
export type ScorecardBand = 'estrategico' | 'desenvolvimento' | 'saida';

export const SCORECARD_BAND_LABELS: Record<ScorecardBand, string> = {
  estrategico: 'Estratégico',
  desenvolvimento: 'Desenvolvimento',
  saida: 'Saída / substituição',
};

export const SCORECARD_DEFAULT_THRESHOLDS = { strategic: 70, development: 40 } as const;

export const DEFAULT_SCORECARD_CRITERIA = [
  { id: 'qualidade', label: 'Qualidade', weight: 25 },
  { id: 'prazo', label: 'Prazo de entrega', weight: 20 },
  { id: 'preco', label: 'Preço/competitividade', weight: 20 },
  { id: 'atendimento', label: 'Atendimento/relacionamento', weight: 15 },
  { id: 'inovacao', label: 'Inovação', weight: 10 },
  { id: 'esg', label: 'ESG/sustentabilidade', weight: 10 },
] as const;

export const ScorecardCriterionSchema = z.object({
  id: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  weight: z.number().min(0.01).max(100),
});
export type ScorecardCriterion = z.infer<typeof ScorecardCriterionSchema>;

export const ScorecardSupplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  segment: z.string().trim().max(120).optional().default(''),
  scores: z.record(z.string(), z.number().min(0).max(10)),
});
export type ScorecardSupplier = z.infer<typeof ScorecardSupplierSchema>;

export const ScorecardParamsSchema = z
  .object({
    scorecardName: z.string().trim().min(1).max(200),
    period: z.string().trim().max(120).optional().default(''),
    notes: z.string().trim().max(2000).optional().default(''),
    criteria: z.array(ScorecardCriterionSchema).min(1).max(15),
    suppliers: z.array(ScorecardSupplierSchema).min(1).max(100),
    thresholds: z
      .object({ strategic: z.number().min(1).max(100), development: z.number().min(0).max(99) })
      .default(SCORECARD_DEFAULT_THRESHOLDS)
      .refine((t) => t.strategic > t.development, { message: 'strategic must be > development' }),
  })
  .refine(
    (p) => p.suppliers.every((s) => p.criteria.every((c) => typeof s.scores[c.id] === 'number')),
    { message: 'every supplier must have a score for every criterion' },
  )
  .refine(
    (p) => new Set(p.criteria.map((c) => c.id)).size === p.criteria.length,
    { message: 'criterion ids must be unique' },
  );
export type ScorecardParams = z.infer<typeof ScorecardParamsSchema>;

export const ScorecardRequestSchema = z.object({
  templateId: z.string().uuid(),
  params: ScorecardParamsSchema,
});
export type ScorecardRequest = z.infer<typeof ScorecardRequestSchema>;

export type ClassifiedSupplier = ScorecardSupplier & {
  weightedScore: number; // 0–100
  rank: number; // 1 = best
  band: ScorecardBand;
};

// ── Homologação de Fornecedor (sub-projeto 36, fase 1) ───────────────────
// Entrada: o CNPJ é o essencial; nome/setor/notas são opcionais. O passo
// determinístico do handler chama o serviço fiscal (lib/fiscal) com o CNPJ.
function isCnpjDigits(s: string): boolean {
  return s.replace(/\D/g, '').length === 14;
}

export const HomologacaoParamsSchema = z.object({
  cnpj: z
    .string()
    .trim()
    .min(14)
    .max(20)
    .refine(isCnpjDigits, { message: 'CNPJ deve ter 14 dígitos' }),
  fornecedorNome: z.string().trim().max(200).optional().default(''),
  // Setor para a comparação de regime tributário (opcional).
  setor: z.enum(['comércio', 'serviços', 'indústria']).optional(),
  faturamentoAnualBRL: z.number().nonnegative().optional(),
  notas: z.string().trim().max(2000).optional().default(''),
});
export type HomologacaoParams = z.infer<typeof HomologacaoParamsSchema>;

export const HomologacaoRequestSchema = z.object({
  templateId: z.string().uuid(),
  params: HomologacaoParamsSchema,
});
export type HomologacaoRequest = z.infer<typeof HomologacaoRequestSchema>;
