import { describe, expect, it } from 'vitest';
import { suppliersToCsv } from '@/lib/suppliers/csv-export';
import type { SupplierResult } from '@/lib/suppliers/types';

function row(overrides: Partial<SupplierResult> = {}): SupplierResult {
  return {
    cnpj: '12345678000190',
    razao_social: 'Empresa Exemplo LTDA',
    nome_fantasia: 'Exemplo',
    cnae_primario: '2222600',
    cnaes_secundarios: ['4729699'],
    porte: 'EPP',
    capital_social: 100000,
    faixa_funcionarios: '10-49',
    uf: 'SP',
    municipio: 'São Paulo',
    telefone: '(11) 99999-9999',
    email: 'contato@exemplo.com.br',
    ultima_atualizacao_rf: '2026-05-01',
    ...overrides,
  };
}

describe('suppliers csv-export', () => {
  it('emits BOM + header + row with `;` separator', () => {
    const csv = suppliersToCsv([row()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('CNPJ;Razão Social');
    expect(lines[1]).toContain('Empresa Exemplo LTDA');
  });

  it('formats CNPJ to standard mask', () => {
    const csv = suppliersToCsv([row({ cnpj: '12345678000190' })]);
    expect(csv).toContain('12.345.678/0001-90');
  });

  it('formats capital social as pt-BR number', () => {
    const csv = suppliersToCsv([row({ capital_social: 1234567.89 })]);
    expect(csv).toContain('1.234.567,89');
  });

  it('escapes fields with semicolons by quoting', () => {
    const csv = suppliersToCsv([
      row({ razao_social: 'Foo; Bar LTDA', email: null }),
    ]);
    expect(csv).toContain('"Foo; Bar LTDA"');
  });

  it('escapes embedded quotes by doubling them', () => {
    const csv = suppliersToCsv([row({ razao_social: 'Foo "X" LTDA' })]);
    expect(csv).toContain('"Foo ""X"" LTDA"');
  });

  it('joins cnaes_secundarios with ` / ` separator', () => {
    const csv = suppliersToCsv([
      row({ cnaes_secundarios: ['1111111', '2222222', '3333333'] }),
    ]);
    expect(csv).toContain('1111111 / 2222222 / 3333333');
  });

  it('renders empty string for null/missing fields', () => {
    const csv = suppliersToCsv([
      row({ nome_fantasia: null, telefone: null, email: null, capital_social: null }),
    ]);
    const dataLine = csv.split('\r\n')[1] ?? '';
    // Capital column should be empty between two semicolons.
    expect(dataLine).toContain(';;');
  });
});
