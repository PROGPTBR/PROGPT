import { describe, it, expect } from 'vitest';
import { computePriceStats, percentile } from '@/lib/govdata/precos';

// Núcleo analítico da pesquisa de preços: estatística ROBUSTA (mediana + IQR +
// descarte de outliers). Preços públicos têm outliers (compra emergencial, item
// trocado), então média simples mente. Estes testes travam o comportamento.

describe('percentile (interpolação linear)', () => {
  it('mediana, quartis e extremos de um conjunto simples', () => {
    const s = [9, 10, 11, 12, 13];
    expect(percentile(s, 0.5)).toBe(11); // mediana
    expect(percentile(s, 0)).toBe(9);
    expect(percentile(s, 1)).toBe(13);
  });

  it('interpola entre ranks quando o índice é fracionário', () => {
    const s = [10, 20]; // n=2
    expect(percentile(s, 0.5)).toBe(15); // (10+20)/2
    expect(percentile(s, 0.25)).toBe(12.5);
  });
});

describe('computePriceStats', () => {
  it('retorna null quando não há amostras', () => {
    expect(computePriceStats([])).toBeNull();
  });

  it('valor único → mediana = p25 = p75 = o valor, n=1', () => {
    const r = computePriceStats([42]);
    expect(r).not.toBeNull();
    expect(r!.mediana).toBe(42);
    expect(r!.p25).toBe(42);
    expect(r!.p75).toBe(42);
    expect(r!.min).toBe(42);
    expect(r!.max).toBe(42);
    expect(r!.n).toBe(1);
    expect(r!.nBruto).toBe(1);
  });

  it('descarta outlier alto via IQR (1.5×) e calcula sobre o conjunto filtrado', () => {
    // [9,10,11,12,13,100] → 100 é outlier; sobra [9..13]
    const r = computePriceStats([10, 12, 11, 13, 9, 100]);
    expect(r).not.toBeNull();
    expect(r!.nBruto).toBe(6);
    expect(r!.n).toBe(5); // 100 removido
    expect(r!.mediana).toBe(11);
    expect(r!.min).toBe(9);
    expect(r!.max).toBe(13);
    expect(r!.outliersRemovidos).toBe(1);
  });

  it('não inventa outlier quando os dados são homogêneos', () => {
    const r = computePriceStats([100, 102, 98, 101, 99]);
    expect(r!.n).toBe(5);
    expect(r!.outliersRemovidos).toBe(0);
    expect(r!.mediana).toBe(100);
  });

  it('ordem de entrada não importa (ordena internamente)', () => {
    const a = computePriceStats([5, 1, 3, 2, 4]);
    const b = computePriceStats([1, 2, 3, 4, 5]);
    expect(a!.mediana).toBe(b!.mediana);
    expect(a!.mediana).toBe(3);
  });

  it('ignora valores não positivos / inválidos', () => {
    const r = computePriceStats([10, 0, -5, 12, NaN, 11]);
    expect(r!.nBruto).toBe(3); // só 10,12,11 entram
    expect(r!.mediana).toBe(11);
  });
});
