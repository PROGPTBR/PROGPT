import { describe, expect, it } from 'vitest';
import {
  extractYear,
  hasContact,
  isPrimaryActivity,
  passesFiscalFilter,
  yearsInMarket,
} from '@/lib/suppliers/ranking';
import type { GroupedSupplier, SupplierResult } from '@/lib/suppliers/types';
import type { FiscalBadge } from '@/lib/fiscal/snapshot';

function unit(over: Partial<SupplierResult> = {}): SupplierResult {
  return {
    cnpj: '12345678000190',
    razao_social: 'ACME',
    nome_fantasia: null,
    cnae_primario: '2222600',
    cnaes_secundarios: null,
    porte: 'ME',
    capital_social: null,
    faixa_funcionarios: null,
    uf: 'SP',
    municipio: 'Sao Paulo',
    telefone: null,
    email: null,
    ultima_atualizacao_rf: null,
    ...over,
  };
}

function group(units: SupplierResult[]): GroupedSupplier {
  return { cnpjBasico: units[0]!.cnpj.slice(0, 8), units };
}

describe('extractYear', () => {
  it('reads a Date', () => {
    expect(extractYear(new Date('1998-04-10T00:00:00Z'))).toBe(1998);
  });
  it('reads yyyy-mm-dd', () => {
    expect(extractYear('2005-12-01')).toBe(2005);
  });
  it('reads yyyymmdd dump format', () => {
    expect(extractYear('19870325')).toBe(1987);
  });
  it('returns null for junk / out of range', () => {
    expect(extractYear(null)).toBeNull();
    expect(extractYear('abc')).toBeNull();
    expect(extractYear('0007')).toBeNull();
    expect(extractYear('3999')).toBeNull();
  });
});

describe('yearsInMarket', () => {
  it('computes diff', () => {
    expect(yearsInMarket(2000, 2026)).toBe(26);
  });
  it('null when unknown or absurd', () => {
    expect(yearsInMarket(null, 2026)).toBeNull();
    expect(yearsInMarket(2030, 2026)).toBeNull(); // futuro
  });
});

describe('isPrimaryActivity', () => {
  it('true when a unit has the searched cnae as primary', () => {
    expect(isPrimaryActivity(group([unit({ cnae_primario: '2222600' })]), '2222600')).toBe(true);
  });
  it('false when it only appears as secondary', () => {
    const g = group([unit({ cnae_primario: '9999999', cnaes_secundarios: ['2222600'] })]);
    expect(isPrimaryActivity(g, '2222600')).toBe(false);
  });
});

describe('hasContact', () => {
  it('true when any unit has phone or email', () => {
    expect(hasContact(group([unit({ telefone: '1130001000' })]))).toBe(true);
    expect(hasContact(group([unit()]))).toBe(false);
  });
});

describe('passesFiscalFilter', () => {
  const active: FiscalBadge = { available: true, situacao: 'ATIVA', score: 90, risco: 'baixo' };
  const baixada: FiscalBadge = { available: true, situacao: 'BAIXADA', score: 20, risco: 'alto' };

  it('passes everything when no filter active', () => {
    expect(passesFiscalFilter(undefined, { onlyActive: false, hideHighRisk: false })).toBe(true);
    expect(passesFiscalFilter(baixada, { onlyActive: false, hideHighRisk: false })).toBe(true);
  });

  it('unverified groups always pass (filter only bites verified)', () => {
    expect(passesFiscalFilter(undefined, { onlyActive: true, hideHighRisk: true })).toBe(true);
    expect(
      passesFiscalFilter({ available: false, situacao: null, score: null, risco: null }, { onlyActive: true, hideHighRisk: false }),
    ).toBe(true);
  });

  it('onlyActive drops non-ATIVA', () => {
    expect(passesFiscalFilter(active, { onlyActive: true, hideHighRisk: false })).toBe(true);
    expect(passesFiscalFilter(baixada, { onlyActive: true, hideHighRisk: false })).toBe(false);
  });

  it('hideHighRisk drops alto/critico', () => {
    expect(passesFiscalFilter(active, { onlyActive: false, hideHighRisk: true })).toBe(true);
    expect(passesFiscalFilter(baixada, { onlyActive: false, hideHighRisk: true })).toBe(false);
    expect(
      passesFiscalFilter({ available: true, situacao: 'ATIVA', score: 10, risco: 'critico' }, { onlyActive: false, hideHighRisk: true }),
    ).toBe(false);
  });
});
