import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  accumulate12m,
  parseBacenNumber,
  resumoIndicadores,
  tendencia,
} from '@/lib/govdata/indicadores';
import { clearGovDataCache } from '@/lib/govdata/cache';

beforeEach(() => clearGovDataCache());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('parseBacenNumber', () => {
  it('converte string com ponto decimal', () => {
    expect(parseBacenNumber('14.25')).toBe(14.25);
    expect(parseBacenNumber('5.1743')).toBeCloseTo(5.1743);
  });
  it('aceita vírgula decimal', () => {
    expect(parseBacenNumber('0,88')).toBeCloseTo(0.88);
  });
  it('retorna null pra valor inválido', () => {
    expect(parseBacenNumber('')).toBeNull();
    expect(parseBacenNumber('x')).toBeNull();
  });
});

describe('accumulate12m (composição de variações mensais)', () => {
  it('compõe 12 variações mensais em acumulado anual', () => {
    // 12 meses de 0,5% cada → (1.005^12 - 1)*100 ≈ 6.17%
    const r = accumulate12m(Array(12).fill(0.5));
    expect(r).toBeCloseTo(6.17, 1);
  });
  it('zero em todos os meses → 0%', () => {
    expect(accumulate12m(Array(12).fill(0))).toBeCloseTo(0, 5);
  });
  it('null quando faltam dados', () => {
    expect(accumulate12m([])).toBeNull();
  });
});

describe('tendencia', () => {
  it('up quando sobe, down quando cai, flat quando estável', () => {
    expect(tendencia([10, 11, 12])).toBe('up');
    expect(tendencia([12, 11, 10])).toBe('down');
    expect(tendencia([10, 10, 10])).toBe('flat');
  });
  it('flat com menos de 2 pontos', () => {
    expect(tendencia([5])).toBe('flat');
    expect(tendencia([])).toBe('flat');
  });
  it('variação ínfima conta como flat', () => {
    expect(tendencia([100, 100.05])).toBe('flat');
  });
});

describe('resumoIndicadores (texto falável)', () => {
  it('monta um resumo curto com os indicadores disponíveis', () => {
    const s = resumoIndicadores({
      selic: { codigo: 432, nome: 'Selic', valor: 14.25, unidade: '% a.a.', data: '05/08/2026' },
      ipca12m: { codigo: 433, nome: 'IPCA 12m', valor: 4.8, unidade: '%', data: '01/05/2026' },
      cambioUsd: { codigo: 1, nome: 'Dólar', valor: 5.17, unidade: 'R$', data: '23/06/2026' },
    });
    expect(s).toMatch(/Selic/i);
    expect(s).toContain('14,25');
    expect(s).toMatch(/IPCA/i);
    expect(s).toContain('4,8');
    expect(s).toContain('5,17');
  });
  it('sinaliza quando nada está disponível', () => {
    expect(resumoIndicadores({ selic: null, ipca12m: null, cambioUsd: null })).toMatch(
      /não.*(disponíve|consegui)/i,
    );
  });
});
