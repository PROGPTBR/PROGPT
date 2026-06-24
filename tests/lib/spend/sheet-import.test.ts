import { describe, it, expect } from 'vitest';
import {
  coerceAmount,
  coerceDate,
  matchHeader,
  parseSpendCsv,
} from '@/lib/spend/sheet-import';

describe('coerceAmount', () => {
  it('pt-BR: ponto de milhar, vírgula decimal', () => {
    expect(coerceAmount('1.234,56')).toBeCloseTo(1234.56, 2);
    expect(coerceAmount('R$ 1.000,00')).toBeCloseTo(1000, 2);
  });
  it('en-US: vírgula de milhar, ponto decimal', () => {
    expect(coerceAmount('2,500.00')).toBeCloseTo(2500, 2);
    expect(coerceAmount('1234.56')).toBeCloseTo(1234.56, 2);
  });
  it('parênteses = negativo', () => {
    expect(coerceAmount('(123)')).toBe(-123);
    expect(coerceAmount('(1.234,50)')).toBeCloseTo(-1234.5, 2);
  });
  it('número puro e vazios', () => {
    expect(coerceAmount(1234.5)).toBe(1234.5);
    expect(coerceAmount('')).toBeNull();
    expect(coerceAmount(null)).toBeNull();
    expect(coerceAmount('abc')).toBeNull();
  });
});

describe('coerceDate', () => {
  it('aceita ISO, DD/MM/YYYY e desambigua MM/DD', () => {
    expect(coerceDate('2025-01-15')).toBe('2025-01-15');
    expect(coerceDate('15/01/2025')).toBe('2025-01-15');
    expect(coerceDate('15-03-2025')).toBe('2025-03-15');
    expect(coerceDate('03/15/2025')).toBe('2025-03-15'); // mês > 12 → swap
  });
  it('retorna null para lixo', () => {
    expect(coerceDate('não é data')).toBeNull();
    expect(coerceDate('')).toBeNull();
    expect(coerceDate(null)).toBeNull();
  });
});

describe('matchHeader', () => {
  it('mapeia cabeçalhos comuns', () => {
    expect(matchHeader('Fornecedor')).toBe('supplier');
    expect(matchHeader('Invoice No')).toBe('invoiceNumber');
    expect(matchHeader('PO Number')).toBe('poNumber');
    expect(matchHeader('País')).toBe('country');
    expect(matchHeader('Moeda')).toBe('currency');
    expect(matchHeader('Valor Total')).toBe('total');
    expect(matchHeader('Data')).toBe('invoiceDate');
    expect(matchHeader('Categoria')).toBe('category');
    expect(matchHeader('coluna estranha')).toBeNull();
  });
});

describe('parseSpendCsv', () => {
  const csv = [
    'Fornecedor;Invoice No;PO;Pais;Moeda;Total;Data;Categoria;Descricao',
    'Acme;INV-1;PO-1;Brasil;BRL;1.234,56;15/01/2025;Produção e Embalagem;Filme PE',
    'Globex;INV-2;Sem PO;EUA;USD;2,500.00;2025-02-10;Consultoria;Advisory',
    'LinhaSemValor;INV-3;PO-3;Brasil;BRL;;2025-03-01;Outros;sem total',
  ].join('\n');

  it('extrai as linhas com valor e pula as sem total', () => {
    const { rows, warnings } = parseSpendCsv(csv);
    expect(rows).toHaveLength(2);
    expect(warnings).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      supplier: 'Acme',
      invoiceNumber: 'INV-1',
      poNumber: 'PO-1',
      country: 'Brasil',
      currency: 'BRL',
      total: 1234.56,
      invoiceDate: '2025-01-15',
      category: 'Produção e Embalagem',
      description: 'Filme PE',
    });
    expect(rows[1]).toMatchObject({ currency: 'USD', total: 2500, invoiceDate: '2025-02-10' });
  });

  it('avisa quando falta a coluna de total', () => {
    const noTotal = 'Fornecedor;Data\nAcme;2025-01-01';
    const { rows, warnings } = parseSpendCsv(noTotal);
    expect(rows).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
