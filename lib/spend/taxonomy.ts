// Taxonomia de categorias de spend (playbook §4). Fonte única da verdade —
// usada pelo extrator (prompt), pelo classificador e pela validação. Categorias
// mutuamente exclusivas; "Outros" é o último recurso.

export const SPEND_CATEGORIES = [
  'Consultoria e Serviços Profissionais',
  'Produção e Embalagem',
  'Eventos e Viagens',
  'Recrutamento e RH',
  'Equipamentos e Maquinário',
  'Serviços Técnicos e P&D',
  'Treinamento e Desenvolvimento',
  'Material de Escritório e Suprimentos',
  'Associações e Doações',
  'Taxas e Licenças Governamentais',
  'Telecomunicações',
  'Marketing e Publicidade',
  'Outros',
] as const;

export type SpendCategory = (typeof SPEND_CATEGORIES)[number];

const SET = new Set<string>(SPEND_CATEGORIES);

/** Remove acentos + lower + trim para comparação tolerante. */
function norm(x: string): string {
  return x
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** True se `s` é exatamente uma categoria canônica. */
export function isSpendCategory(s: string | null | undefined): s is SpendCategory {
  return typeof s === 'string' && SET.has(s);
}

/**
 * Normaliza um texto livre de categoria para a categoria canônica mais próxima
 * (case/acento-insensível). Retorna null quando não bate com nenhuma — o caller
 * decide o fallback ('Outros' ou re-classificar via LLM).
 */
export function coerceSpendCategory(s: string | null | undefined): SpendCategory | null {
  if (!s) return null;
  if (isSpendCategory(s)) return s;
  const target = norm(s);
  for (const c of SPEND_CATEGORIES) {
    if (norm(c) === target) return c;
  }
  return null;
}
