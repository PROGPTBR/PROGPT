import { describe, expect, it } from 'vitest';
import {
  SUPPLIER_STATUSES,
  SUPPLIER_STATUS_LABEL,
  SUPPLIER_STATUS_STYLE,
  cnpjBasicoOf,
  isSupplierStatus,
} from '@/lib/suppliers/base';

describe('suppliers/base', () => {
  it('every status has a label and a style', () => {
    for (const st of SUPPLIER_STATUSES) {
      expect(SUPPLIER_STATUS_LABEL[st]).toBeTruthy();
      expect(SUPPLIER_STATUS_STYLE[st]).toBeTruthy();
    }
  });

  it('isSupplierStatus guards', () => {
    expect(isSupplierStatus('ativo')).toBe(true);
    expect(isSupplierStatus('homologado')).toBe(true);
    expect(isSupplierStatus('inexistente')).toBe(false);
    expect(isSupplierStatus(null)).toBe(false);
    expect(isSupplierStatus(42)).toBe(false);
  });

  it('cnpjBasicoOf takes first 8 digits, tolerating mask', () => {
    expect(cnpjBasicoOf('12.345.678/0001-90')).toBe('12345678');
    expect(cnpjBasicoOf('12345678000190')).toBe('12345678');
    expect(cnpjBasicoOf('123')).toBeNull();
    expect(cnpjBasicoOf(null)).toBeNull();
    expect(cnpjBasicoOf(undefined)).toBeNull();
  });
});

describe('chaveFornecedor', () => {
  it('usa o CNPJ base quando existe', async () => {
    const { chaveFornecedor } = await import('@/lib/suppliers/base');
    expect(chaveFornecedor({ razaoSocial: 'X', cnpj: '12.345.678/0001-90' })).toBe('cnpj:12345678');
  });

  it('sem CNPJ, reconhece o mesmo fornecedor por nome + e-mail, ignorando acento e caixa', async () => {
    const { chaveFornecedor } = await import('@/lib/suppliers/base');
    const a = chaveFornecedor({ razaoSocial: 'Mestre Aço ', email: 'SP09@mestreaco.com' });
    const b = chaveFornecedor({ razaoSocial: 'MESTRE ACO', email: 'sp09@mestreaco.com' });
    expect(a).toBe(b);
  });

  it('o mesmo fornecedor com outro contato vira outro cadastro', async () => {
    const { chaveFornecedor } = await import('@/lib/suppliers/base');
    const a = chaveFornecedor({ razaoSocial: 'ArcelorMittal', email: 'thais@arcelormittal.com' });
    const b = chaveFornecedor({ razaoSocial: 'ArcelorMittal', email: 'daniel@arcelormittal.com' });
    expect(a).not.toBe(b);
  });

  it('sem nome não há chave', async () => {
    const { chaveFornecedor } = await import('@/lib/suppliers/base');
    expect(chaveFornecedor({ razaoSocial: '   ' })).toBeNull();
  });
});
