import type {
  RfpParams,
  KraljicParams,
  PorterParams,
  FinancialParams,
} from './types';
import type { CompanyData } from '@/lib/db/user-company';

// Union of every assistant's form-params shape. Each branch contributes
// its own set of `{{placeholders}}` to the substitution map below; we
// detect which branch we have via "field in params" narrowing.
export type AssistantParams =
  | RfpParams
  | KraljicParams
  | PorterParams
  | FinancialParams;

// Sub-projeto 23 — Programmatic template assembly.
//
// Templates may declare a "verbatim tail" via a marker line. Everything
// above the marker is the LLM's job (customizable structure). Everything
// below is appended by the server with `{{placeholders}}` substituted —
// no LLM round-trip, no paraphrasing risk, no token cost.
//
// Templates without the marker keep the old behavior: full body goes to
// the LLM, no tail is appended. This is the back-compat path.

const MARKER = '<!-- @verbatim-from-here -->';

export function splitTemplateBody(bodyMd: string): {
  head: string;
  tail: string | null;
} {
  const idx = bodyMd.indexOf(MARKER);
  if (idx === -1) return { head: bodyMd, tail: null };
  return {
    head: bodyMd.slice(0, idx).trimEnd(),
    tail: bodyMd.slice(idx + MARKER.length).trimStart(),
  };
}

// Replace every `{{<key>}}` occurrence with the corresponding value.
// Supports form-derived placeholders (per-assistant) AND profile
// company-data placeholders (empresa_*). Unknown placeholders are left
// untouched (defensive — surfaces a bug rather than silently emitting
// an empty string).
//
// Each assistant contributes its own placeholder vocabulary:
//   RFP     → cliente, categoria, escopo, prazo, orcamento, criterios, notas
//   Kraljic → portfolio, periodo, num_itens, spend_total, notas
//   Porter  → categoria, segmento, escopo, observacoes
//
// Field names are distinct across branches (RFP uses English-derived
// 'category'/'scope' fields exposed under PT placeholders; Porter uses
// the PT field names directly), so type-narrowing via `in` is reliable.
export function renderPlaceholders(
  text: string,
  params: AssistantParams,
  company: CompanyData | null = null,
): string {
  const c = company ?? null;
  const substitutions: Record<string, string> = {
    // Profile-derived (always available, independent of assistant type).
    empresa_nome: c?.company_name ?? '',
    empresa_razao_social: c?.company_legal_name ?? '',
    empresa_cnpj: c?.company_cnpj ?? '',
    empresa_email: c?.company_email ?? '',
    empresa_phone: c?.company_phone ?? '',
    empresa_telefone: c?.company_phone ?? '', // PT-BR alias
    empresa_endereco: c?.company_address ?? '',
    empresa_descricao: c?.company_description ?? '',
  };

  if ('client' in params) {
    // RFP
    substitutions.cliente = params.client;
    substitutions.categoria = params.category;
    substitutions.escopo = params.scope;
    substitutions.prazo = params.deadline;
    substitutions.orcamento = params.budget;
    substitutions.criterios =
      params.criteria.length === 0
        ? '(critérios padrão de procurement)'
        : params.criteria.map((cr) => `- ${cr}`).join('\n');
    substitutions.notas = params.notes ?? '';
    // Profile-name falls back to client name when blank — keeps the
    // verbatim tail (assinatura, foro, etc.) sensible if profile is
    // empty.
    if (!substitutions.empresa_nome) substitutions.empresa_nome = params.client;
  } else if ('portfolioName' in params) {
    // Kraljic
    substitutions.portfolio = params.portfolioName;
    substitutions.periodo = params.analysisPeriod ?? '';
    substitutions.num_itens = String(params.items.length);
    substitutions.spend_total = params.items
      .reduce((a, it) => a + (it.spendMM ?? 0), 0)
      .toFixed(2);
    substitutions.notas = params.notes ?? '';
  } else if ('categoria' in params) {
    // Porter
    substitutions.categoria = params.categoria;
    substitutions.segmento = params.segmento ?? '';
    substitutions.escopo = params.escopo ?? '';
    substitutions.observacoes = params.observacoes ?? '';
  } else if ('supplierName' in params) {
    // Financial
    substitutions.fornecedor = params.supplierName;
    substitutions.supplier_name = params.supplierName;
    substitutions.cnpj = params.cnpj ?? '';
    substitutions.ano_referencia = params.referenceYear ?? '';
    substitutions.observacoes = params.observacoes ?? '';
  }

  return text.replace(/\{\{([a-z_]+)\}\}/g, (full, key: string) => {
    const v = substitutions[key];
    return typeof v === 'string' ? v : full;
  });
}

// Back-compat alias for callers that still pass two args.
export function renderTail(tail: string, params: AssistantParams): string {
  return renderPlaceholders(tail, params, null);
}

// HTML comment marker we drop into the assembled output. Lets us later
// split a stored output_md back into "LLM-generated head" and "verbatim
// tail" without keeping them in separate columns. Invisible in rendered
// markdown.
export const ASSEMBLY_BOUNDARY = '<!-- @assembled-tail-below -->';

// Convenience: assemble final output from LLM text + tail rendered with
// params + company. If the template had no tail, the LLM text is
// returned as-is. Marker is dropped between head and tail when both are
// present.
export function assembleOutput(
  llmText: string,
  tail: string | null,
  params: AssistantParams,
  company: CompanyData | null = null,
): string {
  if (!tail) return llmText;
  const rendered = renderPlaceholders(tail, params, company);
  return `${llmText.trimEnd()}\n\n${ASSEMBLY_BOUNDARY}\n\n${rendered}`;
}

// Inverse of assembleOutput — given a stored output_md, return the
// LLM-generated head (what the user can edit via "apply suggestion")
// and the verbatim tail (untouchable). When no marker is present we
// treat the whole document as head (back-compat with rows stored
// before this marker was introduced).
export function splitAssembledOutput(outputMd: string): {
  head: string;
  tail: string | null;
} {
  const idx = outputMd.indexOf(ASSEMBLY_BOUNDARY);
  if (idx === -1) return { head: outputMd, tail: null };
  return {
    head: outputMd.slice(0, idx).trimEnd(),
    tail: outputMd.slice(idx + ASSEMBLY_BOUNDARY.length).trimStart(),
  };
}
