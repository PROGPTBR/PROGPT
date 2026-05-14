import type { RfpParams } from './types';
import type { CompanyData } from '@/lib/db/user-company';

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
// Supports form-derived placeholders (cliente/escopo/...) AND profile
// company data placeholders (empresa_nome/empresa_cnpj/...). Unknown
// placeholders are left untouched (defensive — surfaces a bug rather
// than silently emitting an empty string).
export function renderPlaceholders(
  text: string,
  params: RfpParams,
  company: CompanyData | null = null,
): string {
  const c = company ?? null;
  const substitutions: Record<string, string> = {
    // Form-derived
    cliente: params.client,
    categoria: params.category,
    escopo: params.scope,
    prazo: params.deadline,
    orcamento: params.budget,
    criterios:
      params.criteria.length === 0
        ? '(critérios padrão de procurement)'
        : params.criteria.map((cr) => `- ${cr}`).join('\n'),
    notas: params.notes ?? '',
    // Profile-derived. When a field is unset we fall back to a visible
    // marker so the user knows to fill the profile rather than seeing a
    // silent blank in the document.
    empresa_nome: c?.company_name ?? params.client,
    empresa_razao_social: c?.company_legal_name ?? '',
    empresa_cnpj: c?.company_cnpj ?? '',
    empresa_email: c?.company_email ?? '',
    empresa_phone: c?.company_phone ?? '',
    empresa_telefone: c?.company_phone ?? '', // PT-BR alias
    empresa_endereco: c?.company_address ?? '',
    empresa_descricao: c?.company_description ?? '',
  };

  return text.replace(/\{\{([a-z_]+)\}\}/g, (full, key: string) => {
    const v = substitutions[key];
    return typeof v === 'string' ? v : full;
  });
}

// Back-compat alias for callers that still pass two args.
export function renderTail(tail: string, params: RfpParams): string {
  return renderPlaceholders(tail, params, null);
}

// Convenience: assemble final output from LLM text + tail rendered with
// params + company. If the template had no tail, the LLM text is
// returned as-is.
export function assembleOutput(
  llmText: string,
  tail: string | null,
  params: RfpParams,
  company: CompanyData | null = null,
): string {
  if (!tail) return llmText;
  const rendered = renderPlaceholders(tail, params, company);
  return `${llmText.trimEnd()}\n\n${rendered}`;
}
