import { computeSpendCube } from './cube';
import { normalizeSupplier, dedupeInvoices } from './normalize';
import type { CubeInvoice, SpendCube, SpendInvoiceRow } from './types';

// Constrói o spend cube a partir das linhas persistidas em spend_invoices.
// Compartilhado entre o pipeline e as rotas de export (xlsx/docx/chart) para
// que o relatório e os downloads usem EXATAMENTE a mesma agregação (incl. a
// mesma exclusão de duplicatas).

export function isUsableRow(status: string): boolean {
  return status === 'done' || status === 'needs_review';
}

export function rowToCubeInvoice(r: SpendInvoiceRow): CubeInvoice {
  return {
    supplier: r.supplier ?? '',
    supplierNormalized: r.supplier_normalized || normalizeSupplier(r.supplier),
    category: r.category || 'Outros',
    country: r.country ?? '',
    currency: r.currency ?? '',
    total: r.total,
    totalRef: r.total_ref,
    poNumber: r.po_number,
    invoiceDate: r.invoice_date,
  };
}

export function buildCubeFromRows(
  rows: SpendInvoiceRow[],
  referenceCurrency: string,
): SpendCube {
  const usable = rows.filter((r) => isUsableRow(r.status));
  const { duplicateIds } = dedupeInvoices(
    usable.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      supplierNormalized: r.supplier_normalized || normalizeSupplier(r.supplier),
    })),
  );
  const cubeRows = usable.filter((r) => !duplicateIds.has(r.id)).map(rowToCubeInvoice);
  return computeSpendCube(cubeRows, referenceCurrency);
}
