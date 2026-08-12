import type { CompradorResult } from './comprador';

// Balizamento de preços puro/testável a partir do ranking do Robô Comprador.
// A UI (CompradorPriceChart) só desenha; a matemática de escala/variação fica
// aqui pra ser testada sem DOM.

export type BenchmarkRow = {
  fornecedor: string;
  custoTotal: number;
  /** 0–100: largura da barra proporcional ao MAIOR custo total. */
  pctOfMax: number;
  /** % acima do MENOR custo total (0 no mais barato). */
  deltaVsMinPct: number;
  isCheapest: boolean;
};

/**
 * Ordena do mais barato ao mais caro, ignorando custos indetermináveis
 * (custo_total = 0 ou não-finito — o modelo usa 0 quando não dá pra comparar).
 * Retorna [] quando não há ao menos 1 custo comparável.
 */
export function priceBenchmark(
  ranking: CompradorResult['ranking'],
): BenchmarkRow[] {
  const valid = ranking.filter(
    (r) => Number.isFinite(r.custo_total) && r.custo_total > 0,
  );
  if (valid.length === 0) return [];
  const max = Math.max(...valid.map((r) => r.custo_total));
  const min = Math.min(...valid.map((r) => r.custo_total));
  return [...valid]
    .sort((a, b) => a.custo_total - b.custo_total)
    .map((r) => ({
      fornecedor: r.fornecedor,
      custoTotal: r.custo_total,
      pctOfMax: max > 0 ? (r.custo_total / max) * 100 : 0,
      deltaVsMinPct: min > 0 ? (r.custo_total / min - 1) * 100 : 0,
      isCheapest: r.custo_total === min,
    }));
}
