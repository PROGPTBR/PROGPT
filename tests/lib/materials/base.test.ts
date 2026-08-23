import { describe, expect, it } from 'vitest';
import { codigoOf } from '@/lib/materials/base';

describe('materials/base — codigoOf', () => {
  it('trims and passes through a non-empty code', () => {
    expect(codigoOf('  SKU-123  ')).toBe('SKU-123');
  });
  it('empty/whitespace-only/undefined/null → null (chave ausente)', () => {
    expect(codigoOf('')).toBeNull();
    expect(codigoOf('   ')).toBeNull();
    expect(codigoOf(undefined)).toBeNull();
    expect(codigoOf(null)).toBeNull();
  });
});
