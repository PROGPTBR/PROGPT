'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { computeSpendCube } from '@/lib/spend/cube';
import type { CubeInvoice } from '@/lib/spend/types';

type Row = {
  id: string;
  invoiceNumber: string | null;
  poNumber: string | null;
  supplier: string;
  supplierNormalized: string;
  category: string;
  country: string;
  currency: string;
  total: number | null;
  totalRef: number | null;
  paymentTerms: string | null;
  invoiceDate: string | null;
  status: string;
  lowConfidence: boolean;
};

type Payload = {
  analysisName: string;
  period: string;
  referenceCurrency: string;
  rows: Row[];
};

type SortKey = 'supplier' | 'category' | 'country' | 'totalRef' | 'invoiceDate';

const PO_NONE = /^\s*(sem\s*po|n[ãa]o\s*informad\w*|sem\s*pedido|n\/?a|-)?\s*$/i;
const hasPo = (po: string | null) => po != null && !PO_NONE.test(po);

export function SpendDashboard({ runId }: { runId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [country, setCountry] = useState('all');
  const [category, setCategory] = useState('all');
  const [supplier, setSupplier] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'totalRef',
    dir: 'desc',
  });

  useEffect(() => {
    fetch(`/api/assistants/spend_analysis/${runId}/dashboard`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 409) throw new Error('A análise ainda não está pronta.');
        if (!r.ok) throw new Error(`Falha ao carregar (${r.status}).`);
        return (await r.json()) as Payload;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [runId]);

  const ref = data?.referenceCurrency ?? 'BRL';
  const money = (n: number) => {
    try {
      return n.toLocaleString('pt-BR', { style: 'currency', currency: ref, maximumFractionDigits: 0 });
    } catch {
      return `${ref} ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
    }
  };
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

  // Opções de filtro (do conjunto completo, estáveis).
  const options = useMemo(() => {
    const c = new Set<string>();
    const cat = new Set<string>();
    const sup = new Set<string>();
    for (const r of data?.rows ?? []) {
      if (r.country) c.add(r.country);
      cat.add(r.category);
      if (r.supplier) sup.add(r.supplier);
    }
    return {
      countries: [...c].sort(),
      categories: [...cat].sort(),
      suppliers: [...sup].sort(),
    };
  }, [data]);

  // Linhas filtradas.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (country !== 'all' && r.country !== country) return false;
      if (category !== 'all' && r.category !== category) return false;
      if (supplier !== 'all' && r.supplier !== supplier) return false;
      if (q) {
        const hay = `${r.supplier} ${r.category} ${r.invoiceNumber ?? ''} ${r.poNumber ?? ''} ${r.country}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, country, category, supplier, search]);

  // Cube recomputado sobre as linhas filtradas.
  const cube = useMemo(() => {
    const cubeRows: CubeInvoice[] = filtered.map((r) => ({
      supplier: r.supplier,
      supplierNormalized: r.supplierNormalized || r.supplier,
      category: r.category,
      country: r.country,
      currency: r.currency,
      total: r.total,
      totalRef: r.totalRef,
      poNumber: r.poNumber,
      invoiceDate: r.invoiceDate,
    }));
    return computeSpendCube(cubeRows, ref);
  }, [filtered, ref]);

  const sortedRows = useMemo(() => {
    const arr = [...filtered];
    const dir = sort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (sort.key === 'totalRef') return ((a.totalRef ?? 0) - (b.totalRef ?? 0)) * dir;
      const av = String(a[sort.key] ?? '');
      const bv = String(b[sort.key] ?? '');
      return av.localeCompare(bv) * dir;
    });
    return arr;
  }, [filtered, sort]);

  const anyFilter = country !== 'all' || category !== 'all' || supplier !== 'all' || search.trim() !== '';
  const clearFilters = () => {
    setCountry('all');
    setCategory('all');
    setSupplier('all');
    setSearch('');
  };

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/assistants/history" className="text-sm text-brand underline">
          Voltar ao histórico
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando dashboard…
      </div>
    );
  }

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link
            href={`/assistants/runs/${runId}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao relatório
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {data.analysisName} <span className="text-brand">.</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {data.period ? `${data.period} · ` : ''}Moeda de referência: {ref} · {data.rows.length} notas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/assistants/runs/${runId}/xlsx`}>
            <Button variant="outline" size="sm">
              <Download className="mr-1 h-4 w-4" /> Excel
            </Button>
          </a>
          <a href={`/api/assistants/runs/${runId}/docx`}>
            <Button variant="outline" size="sm">
              <FileText className="mr-1 h-4 w-4" /> Word
            </Button>
          </a>
        </div>
      </div>

      {/* Abas por país */}
      {options.countries.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Tab active={country === 'all'} onClick={() => setCountry('all')}>
            Todos os países
          </Tab>
          {options.countries.map((c) => (
            <Tab key={c} active={country === c} onClick={() => setCountry(c)}>
              {c}
            </Tab>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Gasto total" value={money(cube.totalRef)} />
        <Kpi label="Invoices" value={String(cube.invoiceCount)} />
        <Kpi label="Fornecedores" value={String(cube.bySupplier.length)} />
        <Kpi label="Ticket médio" value={money(cube.ticketMedio)} />
        <Kpi label="Invoices c/ PO" value={pct(cube.poCoveragePct)} />
        <Kpi label="Gasto c/ PO" value={pct(cube.poSpendPct)} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fornecedor, NF, PO…"
            className="rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm w-56"
          />
        </div>
        <FilterSelect label="Categoria" value={category} onChange={setCategory} options={options.categories} />
        <FilterSelect label="Fornecedor" value={supplier} onChange={setSupplier} options={options.suppliers} />
        {anyFilter && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" /> Limpar filtros
          </Button>
        )}
      </div>

      {/* Painéis */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Gasto por categoria">
          <BarList
            rows={cube.byCategory.slice(0, 8)}
            money={money}
            onClick={(k) => setCategory((cur) => (cur === k ? 'all' : k))}
            activeKey={category}
          />
        </Panel>
        <Panel title="Top fornecedores">
          <BarList
            rows={cube.bySupplier.slice(0, 8)}
            money={money}
            onClick={(k) => setSupplier((cur) => (cur === k ? 'all' : k))}
            activeKey={supplier}
          />
        </Panel>
        <Panel title="Cobertura de PO">
          <div className="space-y-3 pt-1">
            <MiniBar label="Invoices com PO" value={cube.poCoveragePct} display={pct(cube.poCoveragePct)} />
            <MiniBar label="Gasto com PO" value={cube.poSpendPct} display={pct(cube.poSpendPct)} />
            <p className="text-[11px] text-muted-foreground">
              Tail spend: {money(cube.tailSpend.tailSpendRef)} em {cube.tailSpend.suppliersBeyond80Pct} fornecedor(es).
            </p>
          </div>
        </Panel>
        <Panel title="Evolução mensal do gasto">
          <MonthlyLine points={cube.byMonth} money={money} />
        </Panel>
      </div>

      {cube.semCambio.length > 0 && (
        <p className="text-[11px] text-amber-600">
          {cube.semCambio.reduce((a, s) => a + s.count, 0)} nota(s) sem conversão cambial (fora do total em {ref}):{' '}
          {cube.semCambio.map((s) => `${s.currency}`).join(', ')}.
        </p>
      )}

      {/* Tabela */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="font-medium">{sortedRows.length} invoices</span>
          <span className="text-muted-foreground">
            Soma (filtrada): <strong className="text-foreground">{money(cube.totalRef)}</strong>
          </span>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-muted-foreground">
                <Th onClick={() => toggleSort('supplier')} sort={sort} k="supplier">Fornecedor</Th>
                <Th onClick={() => toggleSort('category')} sort={sort} k="category">Categoria</Th>
                <th className="px-2 py-1.5 font-medium">NF</th>
                <th className="px-2 py-1.5 font-medium">PO</th>
                <Th onClick={() => toggleSort('country')} sort={sort} k="country">País</Th>
                <th className="px-2 py-1.5 font-medium text-right">Total ({ref})</th>
                <th className="px-2 py-1.5 font-medium">Prazo</th>
                <Th onClick={() => toggleSort('invoiceDate')} sort={sort} k="invoiceDate">Data</Th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-2 py-1.5">
                    {r.supplier || '—'}
                    {r.lowConfidence && <span className="ml-1 text-amber-500" title="baixa certeza">⚠</span>}
                  </td>
                  <td className="px-2 py-1.5">{r.category}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.invoiceNumber ?? '—'}</td>
                  <td className="px-2 py-1.5">
                    {hasPo(r.poNumber) ? (
                      r.poNumber
                    ) : (
                      <span className="text-amber-600">Sem PO</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">{r.country || '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {r.totalRef != null ? money(r.totalRef) : <span className="text-muted-foreground">s/ câmbio</span>}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.paymentTerms ?? '—'}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.invoiceDate ?? '—'}</td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhuma invoice para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        As recomendações de strategic sourcing ficam no relatório completo (sobre o conjunto inteiro).
        Os painéis acima refletem os filtros aplicados.
      </p>
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────

function Th({
  onClick,
  sort,
  k,
  children,
}: {
  onClick: () => void;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  k: SortKey;
  children: React.ReactNode;
}) {
  const active = sort.key === k;
  return (
    <th
      onClick={onClick}
      className="cursor-pointer select-none px-2 py-1.5 font-medium hover:text-foreground"
    >
      {children}
      {active && <span className="ml-0.5">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs transition-colors ${
        active ? 'bg-brand text-white' : 'border border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-background py-1.5 px-2 text-sm max-w-[200px]"
    >
      <option value="all">{label}: todas</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o.length > 28 ? o.slice(0, 27) + '…' : o}
        </option>
      ))}
    </select>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

function BarList({
  rows,
  money,
  onClick,
  activeKey,
}: {
  rows: { key: string; totalRef: number; pct: number }[];
  money: (n: number) => string;
  onClick: (k: string) => void;
  activeKey: string;
}) {
  const max = rows.reduce((a, r) => Math.max(a, r.totalRef), 0) || 1;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">Sem dados.</p>;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <button
          key={r.key}
          onClick={() => onClick(r.key)}
          title={`Filtrar por ${r.key}`}
          className={`block w-full text-left ${activeKey === r.key ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="truncate pr-2">{r.key}</span>
            <span className="tabular-nums text-muted-foreground">{money(r.totalRef)} · {(r.pct * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-0.5 h-2 w-full overflow-hidden rounded bg-muted">
            <div
              className={`h-full rounded ${activeKey === r.key ? 'bg-brand' : 'bg-brand/60'}`}
              style={{ width: `${(r.totalRef / max) * 100}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}

function MiniBar({ label, value, display }: { label: string; value: number; display: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{display}</span>
      </div>
      <div className="mt-0.5 h-2.5 w-full overflow-hidden rounded bg-muted">
        <div className="h-full rounded bg-emerald-500" style={{ width: `${Math.min(value * 100, 100)}%` }} />
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
  if (points.length === 0) return <p className="text-xs text-muted-foreground">Sem datas nas notas.</p>;
  const w = 480;
  const h = 120;
  const pad = { l: 8, r: 8, t: 10, b: 18 };
  const max = points.reduce((a, p) => Math.max(a, p.totalRef), 0) || 1;
  const n = points.length;
  const x = (i: number) => pad.l + (n > 1 ? (i / (n - 1)) * (w - pad.l - pad.r) : (w - pad.l - pad.r) / 2);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.totalRef).toFixed(1)}`).join(' ');
  return (
    <div className="w-full text-brand">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
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
