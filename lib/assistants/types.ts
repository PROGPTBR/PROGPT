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
export type AssistantType = 'rfp';

export const ASSISTANT_TYPES = ['rfp'] as const;

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

// ── Assistant run row shape (DB serialization) ───────────────────────────
export type AssistantRunRow = {
  id: string;
  user_id: string;
  assistant_type: AssistantType;
  template_id: string | null;
  params: RfpParams; // typed by assistant_type; only RFP for now
  output_md: string | null;
  status: ThemeStatusRow;
  error_message: string | null;
  trace_id: string | null;
  created_at: string;
  finished_at: string | null;
};
