// Sub-projeto 16 — open taxonomy with admin curation.
//
// CANONICAL_THEMES is the curated set the classifier prefers and the admin
// sidebar treats as "first-class". The classifier may also propose a new
// theme when nothing in this list fits; those land as candidate themes
// (articles.theme_status = 'candidate') until an admin promotes them.
//
// Adding a canonical theme requires updating BOTH this constant AND any
// CHECK constraints that reference it. The Theme type is preserved for
// back-compat — but theme strings in code/DB are no longer restricted
// to this union; treat Theme as "canonical names" and use plain string
// for the wider open set.
export const CANONICAL_THEMES = [
  'Kraljic',
  'Sourcing Estratégico',
  'SRM',
  'TCO',
  'Sustentabilidade',
  'Risco / Resiliência',
  'Negociação / Contratos',
  'Performance / KPIs',
  'Digital / Tecnologia',
  'Setor Público',
  'Outros',
] as const;

export type Theme = (typeof CANONICAL_THEMES)[number];

export type ThemeStatus = 'canonical' | 'candidate';

export function isCanonicalTheme(s: string): s is Theme {
  return (CANONICAL_THEMES as readonly string[]).includes(s);
}

// Back-compat alias — older imports still resolve. New code should use
// CANONICAL_THEMES / isCanonicalTheme for clarity.
export const TAXONOMY = CANONICAL_THEMES;
export const isValidTheme = isCanonicalTheme;

export const THEME_DESCRIPTIONS: Record<Theme, string> = {
  'Kraljic': 'Matriz de Kraljic, categorização de itens, portfolio de compras',
  'Sourcing Estratégico': 'Strategic sourcing, seleção de fornecedores, RFx',
  'SRM': 'Supplier Relationship Management, gestão de fornecedores',
  'TCO': 'Total Cost of Ownership, custo total, análise de custo-benefício',
  'Sustentabilidade': 'Compras sustentáveis, ESG, ISO 20400/26000, circularidade',
  'Risco / Resiliência': 'Risco da cadeia, resiliência, contingência, disruptions',
  'Negociação / Contratos': 'Técnicas de negociação, gestão contratual, SLA',
  'Performance / KPIs': 'Indicadores de compras, savings, métricas de procurement',
  'Digital / Tecnologia': 'P2P, e-procurement, IA, automação, plataformas digitais',
  'Setor Público': 'Compras públicas, licitação, lei 14.133, transparência',
  'Outros': 'Procurement geral sem encaixe limpo nas demais — ÚLTIMA opção',
};

// Format constraints for LLM-proposed candidate themes. The classifier
// returns free strings; pipeline.normalizeCandidateTheme tidies them up
// before insert, and the DB CHECK enforces 1–50 chars.
export const MAX_THEME_LENGTH = 50;

/**
 * Light normalization of a free-form LLM-proposed theme:
 *  - trim whitespace
 *  - collapse internal whitespace runs to single space
 *  - strip wrapping quotes
 *
 * Does NOT enforce length — callers refine() after normalize so over-long
 * themes are rejected at the validation layer (cleaner than silent truncation,
 * which would map two legitimately different long themes to the same 50-char
 * prefix). For the classifier path, classify-content falls back to "Outros"
 * if the model emits anything that fails this contract.
 *
 * The classifier prompt asks for Title Case PT-BR; we do not force case here
 * to avoid mangling acronyms (PMO, RH, ESG).
 */
export function normalizeCandidateTheme(raw: string): string {
  let t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/\s+/g, ' ');
}
