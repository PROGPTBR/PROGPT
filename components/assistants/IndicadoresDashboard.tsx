'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import {
  ArrowDownRight,
  ArrowUpRight,
  Maximize2,
  Minus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sparkline } from './Sparkline';
import { IndicadorDetailDialog, type DetailCard } from './IndicadorDetailDialog';
import { INDICADORES_DISCLAIMER } from '@/lib/legal/disclaimers';

type IndicadorTipo = 'taxa' | 'indice' | 'cambio' | 'expectativa';
type Tendencia = 'up' | 'down' | 'flat';
type Secao = 'juros_cambio' | 'inflacao_reajuste' | 'custos_expectativas';

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
  secao: Secao;
  fonte: string;
  fonteUrl: string;
  periodo: string;
  abrangencia: string;
  metodologia: string;
  consultadoEm: string;
};

type FonteReferenciada = { fonte: string; cobre: string; aplicacao: string; url: string };
type IndicadorPorCategoria = { categoria: string; referencia: string };

type Painel = {
  disponivel: boolean;
  atualizadoEm: string;
  cards: Card[];
  fontesReferenciadas: FonteReferenciada[];
  indicadorPorCategoria: IndicadorPorCategoria[];
};

const SECAO_ORDER: Secao[] = ['juros_cambio', 'inflacao_reajuste', 'custos_expectativas'];
const SECAO_LABELS: Record<Secao, string> = {
  juros_cambio: 'Juros e câmbio',
  inflacao_reajuste: 'Inflação e reajuste contratual',
  custos_expectativas: 'Custos setoriais e expectativas',
};

// Indicadores sem série SGS por código (ex.: Focus, via OData por nome) não
// têm drill-down interno — abrem a fonte oficial numa nova aba.
const DRILLABLE_TIPOS: IndicadorTipo[] = ['taxa', 'indice', 'cambio'];

function fmt(n: number, frac = 2): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

function valorLabel(c: Card): { big: string; suffix: string } {
  if (c.tipo === 'cambio') return { big: `R$ ${fmt(c.valor)}`, suffix: '' };
  if (c.tipo === 'indice') return { big: `${fmt(c.valor)}%`, suffix: '12m' };
  if (c.tipo === 'expectativa') return { big: `${fmt(c.valor)}%`, suffix: 'Focus 12m' };
  return { big: `${fmt(c.valor)}%`, suffix: 'a.a.' };
}

// Convenção de cor (perspectiva do comprador): cair em juros/inflação/câmbio é
// geralmente favorável → verde; subir → âmbar (atenção). Neutro quando estável.
function tendStyle(t: Tendencia): { Icon: typeof Minus; cls: string; label: string } {
  if (t === 'up') return { Icon: ArrowUpRight, cls: 'text-amber-500', label: 'em alta' };
  if (t === 'down') return { Icon: ArrowDownRight, cls: 'text-emerald-500', label: 'em queda' };
  return { Icon: Minus, cls: 'text-muted-foreground', label: 'estável' };
}

function IndicadorCardView({ c, onOpen }: { c: Card; onOpen: () => void }) {
  const { big, suffix } = valorLabel(c);
  const t = tendStyle(c.tendencia);
  const drillable = DRILLABLE_TIPOS.includes(c.tipo);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={
        drillable
          ? `Ver série histórica de ${c.nome}`
          : `Abrir a fonte oficial de ${c.nome} (${c.fonte})`
      }
      className="group text-left rounded-lg border border-border bg-card p-4 flex flex-col gap-2 transition-all hover:border-brand/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{c.nome}</span>
        <span className="inline-flex items-center gap-1">
          <span className={`inline-flex items-center text-[11px] ${t.cls}`} title={t.label}>
            <t.Icon className="h-3.5 w-3.5" />
          </span>
          <Maximize2 className="h-3 w-3 text-muted-foreground/50 group-hover:text-brand transition-colors" />
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
      <div className="text-[10px] text-muted-foreground/70">{c.fonte}</div>
    </button>
  );
}

export function IndicadoresDashboard() {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leitura, setLeitura] = useState('');
  const [leituraLoading, setLeituraLoading] = useState(false);
  const [selected, setSelected] = useState<DetailCard | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/govdata/indicadores${force ? '?refresh=1' : ''}`, {
        cache: 'no-store',
      });
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
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
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
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 h-40 animate-pulse" />
          ))}
        </div>
      )}

      {painel?.cards && painel.cards.length > 0 &&
        SECAO_ORDER.map((secao) => {
          const cards = painel.cards.filter((c) => c.secao === secao);
          if (cards.length === 0) return null;
          return (
            <div key={secao} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {SECAO_LABELS[secao]}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((c) => (
                  <IndicadorCardView
                    key={c.key}
                    c={c}
                    onOpen={() => {
                      if (!DRILLABLE_TIPOS.includes(c.tipo)) {
                        window.open(c.fonteUrl, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      setSelected({
                        key: c.key,
                        nome: c.nome,
                        unidade: c.unidade,
                        serieLabel: c.serieLabel,
                        descricao: c.descricao,
                        fonte: c.fonte,
                        fonteUrl: c.fonteUrl,
                        periodo: c.periodo,
                        metodologia: c.metodologia,
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}

      <IndicadorDetailDialog card={selected} onClose={() => setSelected(null)} />

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

      {painel && painel.indicadorPorCategoria.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Qual indicador usar em cada compra
          </h2>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2.5 font-medium">Categoria</th>
                  <th className="text-left p-2.5 font-medium">Referência recomendada</th>
                </tr>
              </thead>
              <tbody>
                {painel.indicadorPorCategoria.map((r) => (
                  <tr key={r.categoria} className="border-t border-border">
                    <td className="p-2.5 font-medium whitespace-nowrap">{r.categoria}</td>
                    <td className="p-2.5 text-muted-foreground">{r.referencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Indicador econômico não é cotação de mercado — combine com preços recentes e
            propostas de fornecedores antes de usar num pedido de compra.
          </p>
        </div>
      )}

      {painel && painel.fontesReferenciadas.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Outras fontes de referência
          </h2>
          <p className="text-xs text-muted-foreground">
            Sem integração ao vivo nesta versão — link direto pra consulta.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {painel.fontesReferenciadas.map((f) => (
              <a
                key={f.fonte}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border bg-card p-3 text-xs hover:border-brand/50 hover:shadow-sm transition-all"
              >
                <div className="font-medium text-foreground">{f.fonte}</div>
                <div className="text-muted-foreground mt-1">{f.cobre}</div>
                <div className="text-muted-foreground/80 mt-1 italic">{f.aplicacao}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Fonte: Banco Central do Brasil (séries SGS e Expectativas de Mercado). Valores
        indicativos para apoio à decisão; confirme no provedor oficial antes de usar em
        cláusula contratual.
      </p>
      <p className="text-[11px] text-muted-foreground">{INDICADORES_DISCLAIMER}</p>
    </div>
  );
}
