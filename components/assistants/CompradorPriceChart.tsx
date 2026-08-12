'use client';

import type { CompradorResult } from '@/lib/assistants/comprador';
import { priceBenchmark } from '@/lib/assistants/comprador-benchmark';

const brl = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';

// Gráfico de balizamento de preços — barras horizontais (div, sem lib) do
// custo total comparável por fornecedor, do mais barato ao mais caro, com o
// recomendado destacado e a variação % vs. o menor preço.
export function CompradorPriceChart({
  ranking,
  recommended,
}: {
  ranking: CompradorResult['ranking'];
  recommended: string;
}) {
  const rows = priceBenchmark(ranking);
  if (rows.length < 2) return null; // nada a balizar com < 2 custos comparáveis

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="text-xs font-medium text-muted-foreground">
        Balizamento de preços · custo total comparável
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const isRec = r.fornecedor === recommended;
          return (
            <div key={r.fornecedor} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span
                  className={
                    isRec ? 'font-semibold text-brand' : 'text-foreground'
                  }
                >
                  {r.fornecedor}
                  {isRec ? ' ★' : ''}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {brl(r.custoTotal)}
                  {r.deltaVsMinPct > 0.5 && (
                    <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">
                      +{r.deltaVsMinPct.toFixed(0)}%
                    </span>
                  )}
                  {r.isCheapest && (
                    <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                      menor
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${isRec ? 'bg-brand-gradient' : 'bg-foreground/25'}`}
                  style={{ width: `${Math.max(r.pctOfMax, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground">
        ★ recomendado · barra proporcional ao custo total · % = acima do menor preço
      </div>
    </div>
  );
}
