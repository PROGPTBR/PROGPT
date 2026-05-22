import { z } from 'zod';

// 27 UFs brasileiras (26 estados + DF).
export const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;
export type UF = (typeof UF_LIST)[number];

export const UfSchema = z.enum(UF_LIST);

// ── Classify endpoint ───────────────────────────────────────────────────────

export const ClassifyRequestSchema = z.object({
  query: z.string().min(3).max(500),
});
export type ClassifyRequest = z.infer<typeof ClassifyRequestSchema>;

export const CnaeAlternativeSchema = z.object({
  code: z.string(),
  name: z.string(),
  score: z.number(),
});
export type CnaeAlternative = z.infer<typeof CnaeAlternativeSchema>;

export const ClassifyResponseSchema = z.object({
  cnaeCode: z.string().nullable(),
  cnaeName: z.string().nullable(),
  scope: z.enum(['national', 'regional', 'state', 'city']),
  states: z.array(UfSchema).optional(),
  cities: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  alternatives: z.array(CnaeAlternativeSchema),
});
export type ClassifyResponse = z.infer<typeof ClassifyResponseSchema>;

// ── Search / Export endpoints ───────────────────────────────────────────────

export const SearchRequestSchema = z.object({
  cnae: z.string().regex(/^\d{4,7}$/, 'CNAE precisa ser numérico (4-7 dígitos)'),
  ufs: z.array(UfSchema).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SupplierResultSchema = z.object({
  cnpj: z.string(),
  razao_social: z.string(),
  nome_fantasia: z.string().nullable(),
  cnae_primario: z.string().nullable(),
  cnaes_secundarios: z.array(z.string()).nullable(),
  porte: z.string().nullable(),
  capital_social: z.number().nullable(),
  faixa_funcionarios: z.string().nullable(),
  uf: z.string().nullable(),
  municipio: z.string().nullable(),
  telefone: z.string().nullable(),
  email: z.string().nullable(),
  ultima_atualizacao_rf: z.string().nullable(),
});
export type SupplierResult = z.infer<typeof SupplierResultSchema>;

// Sub-projeto 21 follow-up: agrupar por CNPJ base (primeiros 8 dígitos).
// Empresas com várias filiais batendo no mesmo CNAE+UF apareciam como
// cards repetidos; agora viram 1 card por empresa com expand pra mostrar
// filiais individuais.
export const GroupedSupplierSchema = z.object({
  cnpjBasico: z.string(),
  units: z.array(SupplierResultSchema).min(1),
});
export type GroupedSupplier = z.infer<typeof GroupedSupplierSchema>;

export const SearchResponseSchema = z.object({
  groups: z.array(GroupedSupplierSchema),
  total: z.number().int().min(0),
  cnaeName: z.string().nullable(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// ── CNAE lookup / autocomplete ──────────────────────────────────────────────

export const CnaeInfoSchema = z.object({
  code: z.string(),
  name: z.string(),
  divisao: z.string().nullable(),
  grupo: z.string().nullable(),
});
export type CnaeInfo = z.infer<typeof CnaeInfoSchema>;

export const CnaeSearchResponseSchema = z.object({
  results: z.array(CnaeInfoSchema),
});
export type CnaeSearchResponse = z.infer<typeof CnaeSearchResponseSchema>;

// Cap defensivo do export — 5000 fornecedores ainda gera CSV < 2MB.
export const EXPORT_CAP = 5000;
