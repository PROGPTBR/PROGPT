import { describe, expect, it } from 'vitest';
import { priceBenchmark } from '@/lib/assistants/comprador-benchmark';
import type { CompradorResult } from '@/lib/assistants/comprador';

function item(fornecedor: string, custo_total: number): CompradorResult['ranking'][number] {
  return {
    fornecedor,
    preco: '',
    frete: '',
    impostos: '',
    prazo_entrega: '',
    validade: '',
    condicao_pagamento: '',
    custo_total,
    observacoes: '',
  };
}

describe('priceBenchmark', () => {
  it('sorts cheapest-first and computes deltas', () => {
    const rows = priceBenchmark([item('B', 120), item('A', 100), item('C', 150)]);
    expect(rows.map((r) => r.fornecedor)).toEqual(['A', 'B', 'C']);
    expect(rows[0]!.isCheapest).toBe(true);
    expect(rows[0]!.deltaVsMinPct).toBe(0);
    expect(rows[1]!.deltaVsMinPct).toBeCloseTo(20); // 120/100 - 1
    expect(rows[2]!.deltaVsMinPct).toBeCloseTo(50); // 150/100 - 1
    expect(rows[2]!.pctOfMax).toBe(100); // maior custo
    expect(rows[0]!.pctOfMax).toBeCloseTo(66.67, 1);
  });

  it('ignores indeterminate costs (0 / non-finite)', () => {
    const rows = priceBenchmark([item('A', 100), item('B', 0), item('C', 200)]);
    expect(rows.map((r) => r.fornecedor)).toEqual(['A', 'C']);
  });

  it('returns [] when nothing is comparable', () => {
    expect(priceBenchmark([item('A', 0), item('B', 0)])).toEqual([]);
    expect(priceBenchmark([])).toEqual([]);
  });
});
