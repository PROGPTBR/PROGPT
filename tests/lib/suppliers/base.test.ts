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
