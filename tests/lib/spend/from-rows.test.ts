import { describe, it, expect } from 'vitest';
import { survivingRows, buildCubeFromRows } from '@/lib/spend/from-rows';
import type { SpendInvoiceRow } from '@/lib/spend/types';

function row(p: Partial<SpendInvoiceRow>): SpendInvoiceRow {
  return {
    id: p.id ?? 'x',
    run_id: 'r',
    user_id: 'u',
    storage_path: null,
    filename: 'f.pdf',
    source: 'pdf',
    status: p.status ?? 'done',
    invoice_number: p.invoice_number ?? null,
    po_number: p.po_number ?? null,
    country: p.country ?? 'Brasil',
    currency: p.currency ?? 'BRL',
    total: p.total ?? 100,
    total_ref: p.total_ref ?? 100,
    fx_rate: 1,
    payment_terms: null,
    description: null,
    supplier: p.supplier ?? 'Acme',
    supplier_normalized: p.supplier_normalized ?? 'ACME',
    invoice_date: p.invoice_date ?? '2025-01-01',
    category: p.category ?? 'Outros',
    category_justification: null,
    low_confidence: false,
    ocr_used: false,
    error_message: null,
    created_at: '',
    updated_at: '',
  };
}

describe('survivingRows', () => {
  it('exclui duplicatas (mesmo invoice#+fornecedor) e linhas não-usáveis', () => {
    const rows = [
      row({ id: 'a', invoice_number: 'INV-1' }),
      row({ id: 'b', invoice_number: 'INV-1' }), // duplicata de a
      row({ id: 'c', status: 'error' }), // excluída
      row({ id: 'd', status: 'needs_review', invoice_number: 'INV-2' }),
      row({ id: 'e', status: 'pending' }), // ainda não processada → excluída
    ];
    const ids = survivingRows(rows).map((r) => r.id).sort();
    expect(ids).toEqual(['a', 'd']);
  });

  it('buildCubeFromRows soma só os sobreviventes', () => {
    const rows = [
      row({ id: 'a', invoice_number: 'INV-1', total_ref: 100 }),
      row({ id: 'b', invoice_number: 'INV-1', total_ref: 100 }), // duplicata
      row({ id: 'd', invoice_number: 'INV-2', total_ref: 50 }),
    ];
    const cube = buildCubeFromRows(rows, 'BRL');
    expect(cube.totalRef).toBe(150); // 100 + 50 (b excluída)
    expect(cube.invoiceCount).toBe(2);
  });
});
