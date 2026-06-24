import { describe, it, expect } from 'vitest';
import { normalizeSupplier, dedupeInvoices } from '@/lib/spend/normalize';

describe('normalizeSupplier', () => {
  it('unifica variações de pontuação/sufixo societário', () => {
    expect(normalizeSupplier('Acme Corp.')).toBe(normalizeSupplier('ACME CORP'));
    expect(normalizeSupplier('Contract Packaging Inc.')).toBe(
      normalizeSupplier('Contract Packaging'),
    );
    expect(normalizeSupplier('Globex S.A.')).toBe(normalizeSupplier('Globex SA'));
  });
  it('remove acentos e colapsa espaços', () => {
    expect(normalizeSupplier('  Indústria  Têxtil ')).toBe('INDUSTRIA TEXTIL');
  });
  it('vazio/null → string vazia', () => {
    expect(normalizeSupplier('')).toBe('');
    expect(normalizeSupplier(null)).toBe('');
  });
});

describe('dedupeInvoices', () => {
  it('marca 2ª ocorrência da mesma (invoice#, fornecedor) como duplicata', () => {
    const { duplicateIds, ambiguousIds } = dedupeInvoices([
      { id: 'a', invoiceNumber: 'INV-1', supplierNormalized: 'ACME' },
      { id: 'b', invoiceNumber: 'INV-1', supplierNormalized: 'ACME' },
      { id: 'c', invoiceNumber: 'INV-2', supplierNormalized: 'ACME' },
    ]);
    expect([...duplicateIds]).toEqual(['b']);
    expect(ambiguousIds.size).toBe(0);
  });
  it('linha sem invoice# nunca mescla — vai para ambíguas', () => {
    const { duplicateIds, ambiguousIds } = dedupeInvoices([
      { id: 'a', invoiceNumber: null, supplierNormalized: 'ACME' },
      { id: 'b', invoiceNumber: '', supplierNormalized: 'ACME' },
    ]);
    expect(duplicateIds.size).toBe(0);
    expect([...ambiguousIds].sort()).toEqual(['a', 'b']);
  });
});
