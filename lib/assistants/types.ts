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
export type AssistantType = 'rfp' | 'kraljic';

export const ASSISTANT_TYPES = ['rfp', 'kraljic'] as const;

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

// ── Assistant run row shape (DB serialization) ───────────────────────────
// `params` is discriminated by `assistant_type`. We type it as the union
// here and narrow at the call site. Existing callers that read RFP runs
// continue to cast to RfpParams; new Kraljic callers cast to KraljicParams.
export type AssistantRunRow = {
  id: string;
  user_id: string;
  assistant_type: AssistantType;
  template_id: string | null;
  params: RfpParams | KraljicParams;
  output_md: string | null;
  status: ThemeStatusRow;
  error_message: string | null;
  trace_id: string | null;
  created_at: string;
  finished_at: string | null;
};
