// Normalização de fornecedor + deduplicação de invoices. Funções puras —
// determinísticas e compartilhadas entre o pipeline e os agregados.

/**
 * Normaliza o nome do fornecedor para chave de agrupamento/dedup:
 * uppercase, remove acentos, remove pontuação e sufixos societários comuns
 * (LTDA, S.A., ME, EIRELI, INC, LLC, GMBH...), colapsa espaços.
 * Conservador o suficiente pra unir "Contract Packaging Inc." e "Contract
 * Packaging", sem fundir empresas distintas.
 */
export function normalizeSupplier(s: string | null | undefined): string {
  if (!s) return '';
  let t = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Remove sufixos societários no fim do nome (um ou mais, em sequência).
  const SUFFIX = /\b(LTDA|EIRELI|EPP|ME|MEI|S\s*A|SA|INC|LLC|CORP|CO|GMBH|LTD|BV|AG|SL|SAS)\b/g;
  t = t.replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim();
  return t;
}

export type DedupRow = {
  id: string;
  invoiceNumber: string | null;
  supplierNormalized: string;
};

export type DedupResult = {
  // 2ª+ ocorrência da mesma (invoice#, fornecedor) — excluir dos totais.
  duplicateIds: Set<string>;
  // Sem invoice# → não dá pra deduplicar com segurança; entra nos totais mas
  // é sinalizada para revisão.
  ambiguousIds: Set<string>;
};

/**
 * Deduplica por (invoiceNumber, supplierNormalized). A 1ª ocorrência fica; as
 * repetições vão para `duplicateIds`. Linhas sem invoiceNumber NUNCA são
 * mescladas — vão para `ambiguousIds` (mantidas, mas marcadas).
 */
export function dedupeInvoices(rows: DedupRow[]): DedupResult {
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  const ambiguousIds = new Set<string>();
  for (const r of rows) {
    const num = (r.invoiceNumber ?? '').trim().toLowerCase();
    if (!num) {
      ambiguousIds.add(r.id);
      continue;
    }
    const key = `${num}|${r.supplierNormalized}`;
    if (seen.has(key)) duplicateIds.add(r.id);
    else seen.add(key);
  }
  return { duplicateIds, ambiguousIds };
}
