import type { RfpParams } from './types';

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

// Replace every `{{<key>}}` occurrence with the corresponding param value.
// Unknown placeholders are left untouched (defensive — surfaces a bug
// rather than silently emitting an empty string).
export function renderTail(tail: string, params: RfpParams): string {
  const substitutions: Record<string, string> = {
    cliente: params.client,
    categoria: params.category,
    escopo: params.scope,
    prazo: params.deadline,
    orcamento: params.budget,
    criterios:
      params.criteria.length === 0
        ? '(critérios padrão de procurement)'
        : params.criteria.map((c) => `- ${c}`).join('\n'),
    notas: params.notes ?? '',
  };

  return tail.replace(/\{\{([a-z]+)\}\}/g, (full, key: string) => {
    const v = substitutions[key];
    return typeof v === 'string' ? v : full;
  });
}

// Convenience: assemble final output from LLM text + tail rendered with
// params. If the template had no tail, the LLM text is returned as-is.
export function assembleOutput(
  llmText: string,
  tail: string | null,
  params: RfpParams,
): string {
  if (!tail) return llmText;
  const rendered = renderTail(tail, params);
  return `${llmText.trimEnd()}\n\n${rendered}`;
}
