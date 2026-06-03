// Sub-projeto 32 — limpeza de marca na importação da Biblioteca de Prompts.
//
// O app-fonte (pro-ai-circle) é cheio de marcas proibidas no PROGPT
// (IAgentics, ProAICircle, DealSim — ver memory branding.md / CLAUDE.md). Todo
// conteúdo importado passa por `scrubBranding` antes de virar JSON versionado.
//
// Estratégia: trocar auto-referências de produto pela marca atual (PROGPT) e
// remover ferramentas externas (DealSim) e URLs de marca. Conservador: usa
// limites de palavra pra evitar falso-positivo (ex.: "deal simulation" fica).

type ScrubResult = { text: string; changed: boolean };

// URLs/domínios das marcas proibidas → removidos por completo.
const BRAND_URL = /https?:\/\/(?:www\.)?(?:proaicircle|pro-ai-circle|iagentics|dealsim)\.[a-z][a-z.]*(?:\/\S*)?/gi;

// Ferramenta externa: remover a referência (não substituir por PROGPT).
// \bdeal\s?sim\b casa "DealSim" e "Deal Sim" mas NÃO "deal simulation"
// (não há boundary entre "sim" e "ulation").
const DEALSIM = /\bdeal\s?sim\b/gi;

// Auto-referências de produto → PROGPT.
// Ordem importa: o slug hifenizado antes do padrão com espaços.
const BRAND_TO_PROGPT: RegExp[] = [
  /pro-ai-circle/gi, // slug
  /\bpro\s*ai\s*circle\b/gi, // "PRO AI CIRCLE", "Pro AI Circle", "ProAICircle"
  /\biagentics\b/gi, // IAgentics, iAgentics, iagentics
];

/**
 * Remove/neutraliza marcas proibidas de um texto. Retorna o texto limpo e um
 * flag `changed` (true quando algo foi alterado — útil pra logar diffs e
 * revisar a importação manualmente).
 */
export function scrubBranding(input: string): ScrubResult {
  let out = input;

  out = out.replace(BRAND_URL, '');
  out = out.replace(DEALSIM, '');
  for (const re of BRAND_TO_PROGPT) out = out.replace(re, 'PROGPT');

  // Higiene de espaços deixados por remoções (sem tocar em quebras de linha):
  out = out.replace(/[ \t]{2,}/g, ' '); // colapsa runs de espaço/tab
  out = out.replace(/[ \t]+([.,;:!?])/g, '$1'); // remove espaço antes de pontuação
  out = out.replace(/[ \t]+\n/g, '\n'); // remove espaço no fim da linha

  return { text: out, changed: out !== input };
}
