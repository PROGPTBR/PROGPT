import { describe, it, expect } from 'vitest';
import { pickNearestRate, computeConversion, type RatePoint } from '@/lib/spend/fx';

const USD: RatePoint[] = [
  { iso: '2025-01-10', rate: 5.0 },
  { iso: '2025-01-15', rate: 5.2 },
  { iso: '2025-01-20', rate: 5.1 },
];

describe('pickNearestRate', () => {
  it('pega o último pregão <= data', () => {
    expect(pickNearestRate(USD, '2025-01-16')).toBe(5.2);
    expect(pickNearestRate(USD, '2025-01-20')).toBe(5.1);
  });
  it('data antes da série → primeira; sem data → última; vazio → null', () => {
    expect(pickNearestRate(USD, '2025-01-01')).toBe(5.0);
    expect(pickNearestRate(USD, null)).toBe(5.1);
    expect(pickNearestRate([], '2025-01-16')).toBeNull();
  });
});

describe('computeConversion — ptax', () => {
  const opts = {
    ref: 'BRL',
    fxMode: 'ptax' as const,
    fixedRates: {},
    ptaxByCcy: { USD, EUR: [{ iso: '2025-01-15', rate: 6.0 }] as RatePoint[] },
  };

  it('USD → BRL pela data', () => {
    const r = computeConversion({ total: 100, currency: 'USD', date: '2025-01-16' }, opts);
    expect(r.totalRef).toBeCloseTo(520, 2);
    expect(r.fxRate).toBeCloseTo(5.2, 4);
  });
  it('moeda = referência → 1:1', () => {
    const r = computeConversion({ total: 80, currency: 'BRL', date: '2025-01-16' }, opts);
    expect(r).toEqual({ totalRef: 80, fxRate: 1 });
  });
  it('moeda sem série PTAX → null (sem câmbio)', () => {
    const r = computeConversion({ total: 5000, currency: 'INR', date: '2025-01-16' }, opts);
    expect(r).toEqual({ totalRef: null, fxRate: null });
  });
  it('referência != BRL usa cross-rate via BRL', () => {
    const r = computeConversion(
      { total: 100, currency: 'EUR', date: '2025-01-16' },
      { ...opts, ref: 'USD' },
    );
    // EUR=6.0 BRL, USD=5.2 BRL → 6.0/5.2 ≈ 1.1538
    expect(r.fxRate).toBeCloseTo(6.0 / 5.2, 4);
    expect(r.totalRef).toBeCloseTo(100 * (6.0 / 5.2), 2);
  });
});

describe('computeConversion — fixed', () => {
  const opts = {
    ref: 'BRL',
    fxMode: 'fixed' as const,
    fixedRates: { USD: 5.5 },
    ptaxByCcy: {},
  };
  it('usa a taxa fixa informada', () => {
    const r = computeConversion({ total: 100, currency: 'USD', date: null }, opts);
    expect(r).toEqual({ totalRef: 550, fxRate: 5.5 });
  });
  it('moeda sem taxa fixa → null', () => {
    const r = computeConversion({ total: 100, currency: 'GBP', date: null }, opts);
    expect(r).toEqual({ totalRef: null, fxRate: null });
  });
  it('total null → null', () => {
    const r = computeConversion({ total: null, currency: 'USD', date: null }, opts);
    expect(r).toEqual({ totalRef: null, fxRate: null });
  });
});
