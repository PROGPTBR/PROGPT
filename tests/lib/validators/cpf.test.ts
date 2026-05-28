import { describe, it, expect } from 'vitest';
import { isValidCpf, formatCpf } from '@/lib/validators/cpf';

describe('formatCpf', () => {
  it('strips non-digits', () => {
    expect(formatCpf('123.456.789-09')).toBe('12345678909');
    expect(formatCpf('123 456 789 09')).toBe('12345678909');
    expect(formatCpf('12345678909')).toBe('12345678909');
  });
});

describe('isValidCpf', () => {
  it('accepts a valid CPF', () => {
    // 12345678909 é CPF válido (checksum certo)
    expect(isValidCpf('123.456.789-09')).toBe(true);
    expect(isValidCpf('12345678909')).toBe(true);
  });

  it('rejects CPFs with wrong length', () => {
    expect(isValidCpf('123')).toBe(false);
    expect(isValidCpf('123456789012')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });

  it('rejects CPFs with all same digits', () => {
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('99999999999')).toBe(false);
  });

  it('rejects CPFs with wrong checksum', () => {
    expect(isValidCpf('12345678900')).toBe(false);
    expect(isValidCpf('12345678901')).toBe(false);
  });

  it('handles formatted input', () => {
    expect(isValidCpf('390.533.447-05')).toBe(true);
  });

  it('rejects garbage input', () => {
    expect(isValidCpf('abc')).toBe(false);
    expect(isValidCpf('aaa.bbb.ccc-dd')).toBe(false);
  });
});
