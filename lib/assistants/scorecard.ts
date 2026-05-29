import type { ScorecardParams, ClassifiedSupplier, ScorecardBand } from './types';

export function scoreSuppliers(params: ScorecardParams): ClassifiedSupplier[] {
  const totalWeight = params.criteria.reduce((a, c) => a + c.weight, 0) || 1;
  const scored = params.suppliers.map((s) => {
    const weighted = params.criteria.reduce((acc, c) => {
      const raw = s.scores[c.id] ?? 0;
      return acc + (raw / 10) * (c.weight / totalWeight);
    }, 0);
    const weightedScore = Number((weighted * 100).toFixed(1));
    return { supplier: s, weightedScore };
  });
  const ordered = scored
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => b.weightedScore - a.weightedScore || a.i - b.i);
  const { strategic, development } = params.thresholds;
  return ordered.map((x, idx) => ({
    ...x.supplier,
    weightedScore: x.weightedScore,
    rank: idx + 1,
    band: bandFor(x.weightedScore, strategic, development),
  }));
}

function bandFor(score: number, strategic: number, development: number): ScorecardBand {
  if (score >= strategic) return 'estrategico';
  if (score >= development) return 'desenvolvimento';
  return 'saida';
}
