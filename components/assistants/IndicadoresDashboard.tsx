'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sparkline } from './Sparkline';

type IndicadorTipo = 'taxa' | 'indice' | 'cambio';
type Tendencia = 'up' | 'down' | 'flat';

type Card = {
  key: string;
  nome: string;
  valor: number;
  unidade: string;
  data: string;
  tipo: IndicadorTipo;
  descricao: string;
  serie: { data: string; valor: number }[];
  serieLabel: string;
  tendencia: Tendencia;
};

type Painel = { disponivel: boolean; atualizadoEm: string; cards: Card[] };

function fmt(n: number, frac = 2): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

function valorLabel(c: Card): { big: string; suffix: string } {
  if (c.tipo === 'cambio') return { big: `R$ ${fmt(c.valor)}`, suffix: '' };
  if (c.tipo === 'indice') return { big: `${fmt(c.valor)}%`, suffix: '12m' };
  return { big: `${fmt(c.valor)}%`, suffix: 'a.a.' };
}

// Convenção de cor (perspectiva do comprador): cair em juros/inflação/câmbio é
// geralmente favorável → verde; subir → âmbar (atenção). Neutro quando estável.
function tendStyle(t: Tendencia): { Icon: typeof Minus; cls: string; label: string } {
  if (t === 'up') return { Icon: ArrowUpRight, cls: 'text-amber-500', label: 'em alta' };
  if (t === 'down') return { Icon: ArrowDownRight, cls: 'text-emerald-500', label: 'em queda' };
  return { Icon: Minus, cls: 'text-muted-foreground', label: 'estável' };
}

function IndicadorCardView({ c }: { c: Card }) {
  const { big, suffix } = valorLabel(c);
  const t = tendStyle(c.tendencia);
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{c.nome}</span>
        <span className={`inline-flex items-center gap-0.5 text-[11px] ${t.cls}`} title={t.label}>
          <t.Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{big}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      <div className="text-brand h-9 w-full -my-0.5">
        <Sparkline values={c.serie.map((p) => p.valor)} className="h-full w-full" />
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {c.serieLabel} · em {c.data}
      </div>
      <p className="text-xs text-muted-foreground leading-snug">{c.descricao}</p>
    </div>
  );
}

export function IndicadoresDashboard() {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leitura, setLeitura] = useState('');
  const [leituraLoading, setLeituraLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/govdata/indicadores', { cache: 'no-store' });
      if (res.status === 429) throw new Error('Muitas consultas — aguarde um instante.');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as Painel;
      setPainel(data);
      if (!data.disponivel) setError('Os indicadores estão indisponíveis no momento.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function gerarLeitura() {
    setLeituraLoading(true);
    setLeitura('');
    try {
      const res = await fetch('/api/assistants/indicadores/leitura', { method: 'POST' });
      if (res.status === 429) throw new Error('Muitas consultas — aguarde um instante.');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { leitura: string };
      setLeitura(data.leitura);
    } catch (err) {
      toast.error('Falha ao gerar a leitura', { description: String(err) });
    } finally {
      setLeituraLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Indicadores Econômicos <span className="text-brand">.</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Painel ao vivo do Banco Central (Selic, CDI, IPCA, IGP-M, dólar, euro) para
            balizar custo, reajuste contratual e câmbio nas suas compras.
            {painel?.atualizadoEm && (
              <span className="block text-xs mt-0.5">Atualizado em {painel.atualizadoEm}.</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={gerarLeitura}
            disabled={leituraLoading || loading || !painel?.disponivel}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            {leituraLoading ? 'Lendo o cenário…' : 'Leitura para compras'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {loading && !painel && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 h-40 animate-pulse" />
          ))}
        </div>
      )}

      {painel?.cards && painel.cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {painel.cards.map((c) => (
            <IndicadorCardView key={c.key} c={c} />
          ))}
        </div>
      )}

      {(leituraLoading || leitura) && (
        <div className="rounded-lg border border-brand/30 bg-brand/[0.03] p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Leitura para compras
          </div>
          {leituraLoading && !leitura ? (
            <p className="text-sm text-muted-foreground italic">
              Interpretando o cenário para o gestor de compras…
            </p>
          ) : (
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{leitura}</ReactMarkdown>
            </article>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Fonte: Banco Central do Brasil (séries SGS). Valores indicativos para apoio à decisão;
        confirme no provedor oficial antes de usar em cláusula contratual.
      </p>
    </div>
  );
}
