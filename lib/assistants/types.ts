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
  | 'abc';

export const ASSISTANT_TYPES = [
  'rfp',
  'kraljic',
  'porter',
  'financial',
  'abc',
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
    | AbcParams;
  output_md: string | null;
  status: ThemeStatusRow;
  error_message: string | null;
  trace_id: string | null;
  created_at: string;
  finished_at: string | null;
};
