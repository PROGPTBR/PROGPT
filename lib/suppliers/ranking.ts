import type { FiscalBadge } from '@/lib/fiscal/snapshot';
import type { GroupedSupplier, SupplierResult } from './types';

// Helpers puros de ranking/sinais da lista de fornecedores. Ficam separados
// da query (`search.ts`) e da UI pra serem testáveis sem DB nem DOM.
//
// O SCORE de ordenação real roda no Postgres (ver `search.ts`, ORDER BY):
// combina match no CNAE primário, contactabilidade e porte — porque o sort
// antigo (só capital social) jogava holding/empresa-de-fachada pro topo.
// Aqui ficam os predicados/labels que a UI usa pra refletir esses sinais.

/** Matriz do grupo: unidade de ordem 0001, senão a de maior capital. */
export function pickMatriz(units: SupplierResult[]): SupplierResult {
  const matriz = units.find((u) => u.cnpj.slice(8, 12) === '0001');
  if (matriz) return matriz;
  return [...units].sort(
    (a, b) => (b.capital_social ?? 0) - (a.capital_social ?? 0),
  )[0]!;
}

/**
 * O CNAE buscado é a ATIVIDADE PRINCIPAL de alguma unidade do grupo?
 * Sinal forte de "core business = isto" — quem tem o CNAE só como secundário
 * raramente é fornecedor de verdade daquele item.
 */
export function isPrimaryActivity(
  group: GroupedSupplier,
  searchedCnae: string,
): boolean {
  return group.units.some((u) => u.cnae_primario === searchedCnae);
}

/** Alguma unidade tem telefone ou email — contactabilidade. */
export function hasContact(group: GroupedSupplier): boolean {
  return group.units.some((u) => u.telefone || u.email);
}

/**
 * Extrai o ano (1900–2100) de um valor de data vindo do Postgres, que pode
 * ser Date, 'YYYY-MM-DD' ou 'YYYYMMDD' (formato de dump da Receita). Retorna
 * null quando não dá pra confiar — nunca lança.
 */
export function extractYear(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    return y >= 1900 && y <= 2100 ? y : null;
  }
  const s = String(v).trim();
  const m = s.match(/(\d{4})/); // primeiro bloco de 4 dígitos = ano
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1900 && y <= 2100 ? y : null;
}

/** Anos de mercado a partir do ano de abertura (null se desconhecido). */
export function yearsInMarket(
  aberturaAno: number | null | undefined,
  nowYear: number,
): number | null {
  if (aberturaAno == null) return null;
  const diff = nowYear - aberturaAno;
  return diff >= 0 && diff <= 200 ? diff : null;
}

export type FiscalFilter = {
  /** Só empresas com situação cadastral ATIVA. */
  onlyActive: boolean;
  /** Esconde risco 'alto' e 'critico'. */
  hideHighRisk: boolean;
};

/**
 * Um grupo passa no filtro fiscal? Grupos AINDA não enriquecidos (sem badge)
 * passam sempre — o filtro só morde o que já foi verificado, pra não sumir
 * com a lista inteira antes do usuário clicar em "Verificar nas bases do governo".
 */
export function passesFiscalFilter(
  badge: FiscalBadge | undefined,
  filter: FiscalFilter,
): boolean {
  if (!filter.onlyActive && !filter.hideHighRisk) return true;
  if (!badge || !badge.available) return true; // não verificado → não filtra
  if (filter.onlyActive && badge.situacao !== 'ATIVA') return false;
  if (
    filter.hideHighRisk &&
    (badge.risco === 'alto' || badge.risco === 'critico')
  ) {
    return false;
  }
  return true;
}
