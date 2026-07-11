'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  RefreshCw,
  MessageSquare,
  Sparkles,
  Receipt,
  Building2,
  Loader2,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import type { DashboardPayload } from '@/lib/dashboard/types';

// Painel unificado ("dashboard estilo Power BI") — visão única de TODOS os
// dados do cliente: conversas, execuções de assistentes, gasto analisado e
// plano. Consome GET /api/dashboard (owner-scoped). Gráficos em SVG puro, sem
// dependência, tema-aware (padrão do Spend Analysis / Indicadores).

export function UnifiedDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as DashboardPayload);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar o painel. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const money = (n: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: data?.spend?.referenceCurrency || 'BRL',
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-brand">
            <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Painel unificado
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight break-words">
            {data?.company.name ? data.company.name : 'Seus dados'}{' '}
            <span className="text-brand">.</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os seus dados em um só lugar — atualizado em tempo real, sem
            planilha nem Power BI.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-brand/40 hover:text-brand transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          Atualizar
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {loading && !data && <DashboardSkeleton />}

      {data && (
        <>
          {/* KPIs gerais */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi
              icon={<MessageSquare className="h-4 w-4" />}
              label="Conversas"
              value={data.overview.sessions.toLocaleString('pt-BR')}
            />
            <Kpi
              icon={<Sparkles className="h-4 w-4" />}
              label="Execuções"
              value={data.overview.assistantRuns.toLocaleString('pt-BR')}
            />
            <Kpi
              icon={<Wallet className="h-4 w-4" />}
              label="Gasto analisado"
              value={data.overview.spendAnalyzedRef > 0 ? money(data.overview.spendAnalyzedRef) : '—'}
            />
            <Kpi
              icon={<Receipt className="h-4 w-4" />}
              label="Notas processadas"
              value={data.overview.invoicesProcessed.toLocaleString('pt-BR')}
            />
            <Kpi
              icon={<Building2 className="h-4 w-4" />}
              label="Fornecedores"
              value={data.overview.suppliersAnalyzed.toLocaleString('pt-BR')}
            />
            <Kpi
              icon={<LayoutDashboard className="h-4 w-4" />}
              label="Categorias"
              value={data.overview.categoriesCovered.toLocaleString('pt-BR')}
            />
          </section>

          {/* Atividade + execuções por assistente */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Atividade nos últimos 12 meses">
              <ActivityChart series={data.activityByMonth} />
              <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                <Legend color="bg-brand" label="Conversas" />
                <Legend color="bg-emerald-500" label="Execuções" />
              </div>
            </Panel>

            <Panel title="Execuções por assistente">
              {data.runsByType.length === 0 ? (
                <Empty text="Você ainda não executou nenhum assistente." />
              ) : (
                <CountBarList rows={data.runsByType} />
              )}
            </Panel>
          </section>

          {/* Gasto (Análise de Gastos) */}
          {data.spend ? (
            <section className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Gasto total" value={money(data.spend.totalRef)} />
                <Kpi label="Notas com câmbio" value={data.spend.invoiceCount.toLocaleString('pt-BR')} />
                <Kpi label="Ticket médio" value={money(data.spend.ticketMedio)} />
                <Kpi label="Cobertura de PO" value={`${Math.round(data.spend.poCoveragePct)}%`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Gasto por categoria">
                  <MoneyBarList rows={data.spend.byCategory} money={money} />
                </Panel>
                <Panel title="Top fornecedores por gasto">
                  <MoneyBarList rows={data.spend.bySupplier} money={money} />
                </Panel>
              </div>

              <Panel title="Evolução mensal do gasto">
                <MonthlyLine points={data.spend.byMonth} money={money} />
              </Panel>
            </section>
          ) : (
            <SpendEmptyState />
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon && <span className="text-brand">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-lg sm:text-xl font-semibold tabular-nums leading-tight break-words">
        {value}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h3 className="mb-4 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

function CountBarList({ rows }: { rows: { label: string; count: number }[] }) {
  const max = rows.reduce((a, r) => Math.max(a, r.count), 0) || 1;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-[11px]">
            <span className="truncate pr-2">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">{r.count}</span>
          </div>
          <div className="mt-0.5 h-2 w-full overflow-hidden rounded bg-muted">
            <div className="h-full rounded bg-brand/70" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MoneyBarList({
  rows,
  money,
}: {
  rows: { key: string; totalRef: number; pct: number }[];
  money: (n: number) => string;
}) {
  const max = rows.reduce((a, r) => Math.max(a, r.totalRef), 0) || 1;
  if (rows.length === 0) return <Empty text="Sem dados." />;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-center justify-between text-[11px]">
            <span className="truncate pr-2">{r.key}</span>
            <span className="tabular-nums text-muted-foreground">
              {money(r.totalRef)} · {(r.pct * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-0.5 h-2 w-full overflow-hidden rounded bg-muted">
            <div className="h-full rounded bg-brand/70" style={{ width: `${(r.totalRef / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityChart({
  series,
}: {
  series: { key: string; sessions: number; runs: number }[];
}) {
  if (series.length < 2) return <Empty text="Sem histórico suficiente ainda." />;
  const w = 520;
  const h = 150;
  const pad = { l: 8, r: 8, t: 10, b: 20 };
  const max =
    series.reduce((a, p) => Math.max(a, p.sessions, p.runs), 0) || 1;
  const n = series.length;
  const x = (i: number) => pad.l + (i / (n - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const path = (get: (p: (typeof series)[number]) => number) =>
    series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(' ');

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36 sm:h-44" preserveAspectRatio="none">
        <path
          d={path((p) => p.sessions)}
          fill="none"
          className="text-brand"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path((p) => p.runs)}
          fill="none"
          className="text-emerald-500"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{series[0]!.key}</span>
        <span>{series[series.length - 1]!.key}</span>
      </div>
    </div>
  );
}

function MonthlyLine({
  points,
  money,
}: {
  points: { key: string; totalRef: number }[];
  money: (n: number) => string;
}) {
  if (points.length === 0) return <Empty text="Sem datas nas notas." />;
  const w = 900;
  const h = 160;
  const pad = { l: 8, r: 8, t: 12, b: 20 };
  const max = points.reduce((a, p) => Math.max(a, p.totalRef), 0) || 1;
  const n = points.length;
  const x = (i: number) => pad.l + (n > 1 ? (i / (n - 1)) * (w - pad.l - pad.r) : (w - pad.l - pad.r) / 2);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.totalRef).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${h - pad.b} L${x(0).toFixed(1)},${h - pad.b} Z`;
  return (
    <div className="w-full text-brand">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40 sm:h-48" preserveAspectRatio="none">
        <path d={area} fill="currentColor" fillOpacity={0.1} stroke="none" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <circle key={p.key} cx={x(i)} cy={y(p.totalRef)} r="2.5" fill="currentColor" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{points[0]!.key}</span>
        <span>pico {money(max)}</span>
        <span>{points[points.length - 1]!.key}</span>
      </div>
    </div>
  );
}

function SpendEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <Wallet className="mx-auto h-8 w-8 text-brand" aria-hidden="true" />
      <h3 className="mt-3 text-lg font-semibold">Desbloqueie os painéis de gasto</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Rode a <strong>Análise de Gastos</strong> com suas notas fiscais (PDF ou
        planilha) e este painel passa a mostrar gasto por categoria, top
        fornecedores, evolução mensal e cobertura de PO — automaticamente.
      </p>
      <Link
        href="/assistants/spend_analysis"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black px-5 py-2.5 text-sm font-semibold hover:brightness-110 active:scale-95 transition-all"
      >
        Abrir Análise de Gastos
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-56 rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-56 rounded-xl border border-border bg-card animate-pulse" />
      </div>
    </div>
  );
}
