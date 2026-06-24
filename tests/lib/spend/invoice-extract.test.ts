import { describe, it, expect } from 'vitest';
import { _testing } from '@/lib/spend/invoice-extract';

const { normalizeFields, ExtractedSchema } = _testing;

describe('invoice-extract — schema', () => {
  it('aceita JSON parcial (todos os campos opcionais/nullable)', () => {
    expect(() => ExtractedSchema.parse({ total: 100, currency: 'usd' })).not.toThrow();
    expect(() => ExtractedSchema.parse({})).not.toThrow();
  });
});

describe('invoice-extract — normalizeFields', () => {
  it('normaliza campos válidos + uppercase da moeda + categoria canônica', () => {
    const out = normalizeFields({
      invoiceNumber: ' INV-7 ',
      poNumber: 'PO-7',
      country: 'Brasil',
      currency: 'usd',
      total: 1500.5,
      paymentTerms: 'Net 30',
      description: 'Serviço de consultoria',
      supplier: 'Globex',
      invoiceDate: '2025-04-01',
      category: 'Consultoria e Serviços Profissionais',
      categoryJustification: 'Serviço por hora',
      lowConfidence: false,
      ocrUsed: false,
    });
    expect(out.invoiceNumber).toBe('INV-7');
    expect(out.currency).toBe('USD');
    expect(out.total).toBe(1500.5);
    expect(out.category).toBe('Consultoria e Serviços Profissionais');
    expect(out.lowConfidence).toBe(false);
  });

  it('categoria fora da taxonomia vira null e marca lowConfidence', () => {
    const out = normalizeFields({ total: 50, category: 'Categoria Inventada' });
    expect(out.category).toBeNull();
    expect(out.lowConfidence).toBe(true);
  });

  it('strings vazias viram null; total inválido vira null', () => {
    const out = normalizeFields({
      invoiceNumber: '   ',
      total: Number.NaN,
      supplier: '',
    });
    expect(out.invoiceNumber).toBeNull();
    expect(out.supplier).toBeNull();
    expect(out.total).toBeNull();
  });

  it('coage categoria acento/case-insensível à canônica', () => {
    const out = normalizeFields({ total: 10, category: 'telecomunicacoes' });
    expect(out.category).toBe('Telecomunicações');
    expect(out.lowConfidence).toBe(false);
  });
});
