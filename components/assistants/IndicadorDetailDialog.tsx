'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TimeSeriesChart } from './TimeSeriesChart';

export type DetailCard = {
  key: string;
  nome: string;
  unidade: string;
  serieLabel: string;
  descricao: string;
};

type Pt = { data: string; valor: number };

const RANGES = [
  { label: '6M', meses: 6 },
  { label: '1A', meses: 12 },
  { label: '2A', meses: 24 },
  { label: '5A', meses: 60 },
  { label: '10A', meses: 120 },
] as const;

const DEFAULT_MESES = 24;

export function IndicadorDetailDialog({
  card,
  onClose,
}: {
  card: DetailCard | null;
  onClose: () => void;
}) {
  const [meses, setMeses] = useState<number>(DEFAULT_MESES);
  const [pontos, setPontos] = useState<Pt[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async (key: string, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/govdata/indicadores/serie?key=${key}&meses=${m}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { pontos: Pt[] };
      setPontos(data.pontos);
    } catch (err) {
      toast.error('Falha ao carregar a série', { description: String(err) });
      setPontos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (card) {
      setMeses(DEFAULT_MESES);
      setPontos([]);
      void load(card.key, DEFAULT_MESES);
    }
  }, [card, load]);

  function pick(m: number) {
    if (!card) return;
    setMeses(m);
    void load(card.key, m);
  }

  async function exportar() {
    if (!card) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/govdata/indicadores/xlsx?key=${card.key}&meses=${meses}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${card.key}-${meses}m.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Falha ao exportar', { description: String(err) });
    } finally {
      setDownloading(false);
    }
  }

  const values = pontos.map((p) => p.valor);
  const stats =
    values.length > 0
      ? {
          atual: values[values.length - 1]!,
          min: Math.min(...values),
          max: Math.max(...values),
          media: values.reduce((a, b) => a + b, 0) / values.length,
        }
      : null;

  const fmt = (v: number) =>
    card?.unidade === 'R$'
      ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
      : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${card?.unidade.includes('%') ? '%' : ''}`;

  return (
    <Dialog
      open={!!card}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        {card && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{card.nome} · série histórica</DialogTitle>
            </DialogHeader>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="inline-flex rounded-md border border-border overflow-hidden">
                {RANGES.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => pick(r.meses)}
                    className={`px-3 py-1 text-xs transition-colors ${
                      meses === r.meses
                        ? 'bg-brand/15 text-brand font-medium'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={exportar}
                disabled={downloading || loading || pontos.length === 0}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                {downloading ? 'Exportando…' : 'Exportar Excel'}
              </Button>
            </div>

            <div className="min-h-[260px]">
              {loading && pontos.length === 0 ? (
                <div className="h-[260px] animate-pulse rounded-md bg-muted" />
              ) : (
                <TimeSeriesChart pontos={pontos} unidade={card.unidade} />
              )}
            </div>

            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {(
                  [
                    ['Atual', stats.atual],
                    ['Mínimo', stats.min],
                    ['Máximo', stats.max],
                    ['Média', stats.media],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="rounded-md border border-border bg-card p-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{fmt(v)}</div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              {card.serieLabel} · fonte: Banco Central do Brasil (séries SGS).
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
