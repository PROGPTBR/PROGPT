'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Upload, Sparkles, X, RefreshCw, Filter, Search,
  BarChart3, ChevronDown, Table2, LayoutDashboard, TrendingUp,
} from 'lucide-react';
import {
  buildDataset, planDashboard, autoKpis, groupBy, topN, timeSeries,
  crosstab, scatterPairs, keyOf, coerceNumber,
  looksLikeMoney, looksLikePercent,
  type Dataset, type Row, type Agg,
} from '@/lib/dashboard/analyze';
import { parseSpreadsheetFile, fmtBy, fmtNumber } from '@/lib/dashboard/parse-file';
import { sampleDataset } from '@/lib/dashboard/sample';
import {
  Panel, TimeSeriesArea, RankBar, ShareDonut, StackedBars,
  BubbleScatter, ProfileRadar, Heatmap, PALETTE,
} from './StudioCharts';

type Fmt = 'number' | 'currency' | 'percent';
const fmtOf = (name: string | null): Fmt =>
  !name ? 'number' : looksLikeMoney(name) ? 'currency' : looksLikePercent(name) ? 'percent' : 'number';

const AGG_LABEL: Record<Agg, string> = { sum: 'Soma', mean: 'Média', count: 'Contagem', min: 'Mínimo', max: 'Máximo' };

export function DataStudio() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback((rows: Row[], name: string) => {
    if (rows.length === 0) {
      toast.error('A planilha parece vazia ou sem cabeçalho reconhecível.');
      return;
    }
    setDataset(buildDataset(rows));
    setSourceName(name);
  }, []);

  const onFile = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const parsed = await parseSpreadsheetFile(file);
        load(parsed.rows, parsed.name);
        toast.success(`${parsed.rows.length.toLocaleString('pt-BR')} linhas carregadas.`);
      } catch (err) {
        console.error(err);
        toast.error('Não consegui ler o arquivo. Use .xlsx, .csv ou .tsv.');
      } finally {
        setLoading(false);
      }
    },
    [load],
  );

  const loadSample = useCallback(() => {
    const s = sampleDataset();
    load(s.rows, s.name);
  }, [load]);

  if (!dataset) {
    return (
      <UploadHero
        loading={loading}
        dragOver={dragOver}
        setDragOver={setDragOver}
        inputRef={inputRef}
        onFile={onFile}
        onSample={loadSample}
      />
    );
  }

  return (
    <StudioBody
      dataset={dataset}
      sourceName={sourceName}
      onReplace={() => inputRef.current?.click()}
      inputRef={inputRef}
      onFile={onFile}
    />
  );
}

// ─── Upload / empty state ───────────────────────────────────────────────────

function UploadHero({
  loading, dragOver, setDragOver, inputRef, onFile, onSample,
}: {
  loading: boolean;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
  onSample: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center py-6 sm:py-12">
      <div className="inline-flex items-center gap-2 text-brand">
        <LayoutDashboard className="h-5 w-5" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wider">Dashboard</span>
      </div>
      <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
        Sua planilha vira um <span className="text-brand-gradient">painel</span>.
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-sm sm:text-base text-muted-foreground">
        Solte qualquer planilha de compras (Excel ou CSV) e veja, em segundos,
        KPIs, tendências, rankings e cruzamentos — no mesmo nível do Power BI,
        sem configurar nada.
      </p>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`mt-8 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 transition-all ${
          dragOver ? 'border-brand bg-brand/5 scale-[1.01]' : 'border-border bg-card hover:border-brand/50'
        }`}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-soft">
          {loading ? (
            <RefreshCw className="h-6 w-6 animate-spin text-brand" aria-hidden />
          ) : (
            <Upload className="h-6 w-6 text-brand" aria-hidden />
          )}
        </span>
        <span className="text-sm font-medium text-foreground">
          {loading ? 'Processando…' : 'Arraste a planilha aqui ou clique para escolher'}
        </span>
        <span className="text-xs text-muted-foreground">.xlsx · .csv · .tsv — até 20 mil linhas</span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
      </label>

      <div className="mt-5 flex items-center justify-center gap-3 text-sm">
        <span className="text-muted-foreground">Não tem uma agora?</span>
        <button
          onClick={onSample}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-black px-4 py-2 font-semibold hover:brightness-110 active:scale-95 transition-all"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Ver com dados de exemplo
        </button>
      </div>
    </div>
  );
}

// ─── Corpo do dashboard ─────────────────────────────────────────────────────

function StudioBody({
  dataset, sourceName, onReplace, inputRef, onFile,
}: {
  dataset: Dataset;
  sourceName: string;
  onReplace: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
}) {
  const plan = useMemo(() => planDashboard(dataset.columns), [dataset]);

  const [measure, setMeasure] = useState<string | null>(plan.primaryMeasure);
  const [dim, setDim] = useState<string | null>(plan.primaryDimension);
  const [dim2, setDim2] = useState<string | null>(plan.secondaryDimension);
  const [agg, setAgg] = useState<Agg>('sum');
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Reset seleções ao trocar de planilha.
  useEffect(() => {
    setMeasure(plan.primaryMeasure);
    setDim(plan.primaryDimension);
    setDim2(plan.secondaryDimension);
    setAgg('sum');
    setFilters({});
  }, [plan]);

  const format = fmtOf(measure);
  const effectiveAgg: Agg = measure ? agg : 'count';

  // Aplica slicers.
  const rows = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v && v !== '__all__');
    if (active.length === 0) return dataset.rows;
    return dataset.rows.filter((r) => active.every(([col, val]) => keyOf(r[col]) === val));
  }, [dataset.rows, filters]);

  const kpis = useMemo(() => autoKpis({ rows, columns: dataset.columns }, plan), [rows, dataset.columns, plan]);

  const rank = useMemo(
    () => (dim ? topN(groupBy(rows, dim, measure, effectiveAgg), 10) : []),
    [rows, dim, measure, effectiveAgg],
  );
  const donut = useMemo(() => {
    const d = dim2 ?? dim;
    return d ? topN(groupBy(rows, d, measure, effectiveAgg), 7) : [];
  }, [rows, dim, dim2, measure, effectiveAgg]);
  const series = useMemo(
    () => (plan.dateColumn ? timeSeries(rows, plan.dateColumn, measure, effectiveAgg) : []),
    [rows, plan.dateColumn, measure, effectiveAgg],
  );
  const cross = useMemo(
    () => (dim && dim2 ? crosstab(rows, dim, dim2, measure) : null),
    [rows, dim, dim2, measure],
  );
  const radar = useMemo(
    () => (dim ? topN(groupBy(rows, dim, measure, effectiveAgg), 8) : []),
    [rows, dim, measure, effectiveAgg],
  );
  const scatter = useMemo(() => {
    const m1 = plan.measures[0];
    const m2 = plan.measures[1];
    if (!m1 || !m2) return null;
    return { data: scatterPairs(rows, m1, m2, dim).slice(0, 400), x: m1, y: m2 };
  }, [rows, plan.measures, dim]);

  const slicerDims = plan.dimensions.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-brand">
            <LayoutDashboard className="h-5 w-5" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wider">Dashboard</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight break-words">
            {sourceName} <span className="text-brand">.</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {dataset.rows.length.toLocaleString('pt-BR')} linhas ·{' '}
            {dataset.columns.length} colunas · gerado automaticamente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm,.csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={onReplace}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-brand/40 hover:text-brand transition-colors"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Trocar planilha
          </button>
        </div>
      </header>

      {/* Controles (medida / dimensão / agregação) */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground pr-1">
          <BarChart3 className="h-3.5 w-3.5 text-brand" aria-hidden /> Analisar
        </span>
        {plan.measures.length > 0 && (
          <FieldSelect label="Medida" value={measure ?? ''} onChange={(v) => setMeasure(v || null)} options={plan.measures} allowNone noneLabel="Contagem" />
        )}
        {measure && (
          <FieldSelect label="Como" value={agg} onChange={(v) => setAgg(v as Agg)} options={['sum', 'mean', 'max', 'min']} render={(v) => AGG_LABEL[v as Agg]} />
        )}
        <FieldSelect label="Por" value={dim ?? ''} onChange={(v) => setDim(v || null)} options={plan.dimensions} />
        {plan.dimensions.length > 1 && (
          <FieldSelect label="Cruzar com" value={dim2 ?? ''} onChange={(v) => setDim2(v || null)} options={plan.dimensions.filter((d) => d !== dim)} allowNone noneLabel="—" />
        )}
      </div>

      {/* Slicers */}
      {slicerDims.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5 text-brand" aria-hidden /> Filtros
          </span>
          {slicerDims.map((d) => (
            <Slicer
              key={d}
              label={d}
              options={groupBy(dataset.rows, d, null).map((s) => s.key).slice(0, 60)}
              value={filters[d] ?? '__all__'}
              onChange={(v) => setFilters((f) => ({ ...f, [d]: v }))}
            />
          ))}
          {Object.values(filters).some((v) => v && v !== '__all__') && (
            <button onClick={() => setFilters({})} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-3 w-3" aria-hidden /> Limpar
            </button>
          )}
        </div>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k, i) => (
          <KpiCard key={k.label} label={k.label} value={fmtBy(k.format, k.value)} accent={PALETTE[i % PALETTE.length]!} />
        ))}
      </section>

      {/* Grid de gráficos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {series.length > 1 && (
          <Panel className="lg:col-span-2" title={`Evolução no tempo${measure ? ` · ${measure}` : ''}`} subtitle="Agregado por mês">
            <TimeSeriesArea data={series} format={format} />
          </Panel>
        )}

        {dim && rank.length > 0 && (
          <Panel title={`Ranking por ${dim}`} subtitle={`${AGG_LABEL[effectiveAgg]}${measure ? ` de ${measure}` : ' de linhas'} · top 10`}>
            <RankBar data={rank} format={format} />
          </Panel>
        )}

        {donut.length > 0 && (
          <Panel title={`Participação por ${dim2 ?? dim}`} subtitle="Composição do total">
            <ShareDonut data={donut} format={format} />
          </Panel>
        )}

        {cross && (
          <Panel className="lg:col-span-2" title={`${dim} × ${dim2}`} subtitle="Barras empilhadas">
            <StackedBars crosstab={cross} format={format} />
          </Panel>
        )}

        {scatter && (
          <Panel title="Dispersão" subtitle={`${scatter.x} × ${scatter.y}`}>
            <BubbleScatter data={scatter.data} xName={scatter.x} yName={scatter.y} format={fmtOf(scatter.x)} />
          </Panel>
        )}

        {radar.length >= 3 && (
          <Panel title={`Perfil por ${dim}`} subtitle="Visão em radar">
            <ProfileRadar data={radar} format={format} />
          </Panel>
        )}

        {cross && (
          <Panel className="lg:col-span-2" title={`Mapa de calor · ${dim} × ${dim2}`} subtitle="Intensidade do valor por combinação">
            <Heatmap crosstab={cross} format={format} />
          </Panel>
        )}
      </section>

      {/* Tabela */}
      <DataTable dataset={dataset} rows={rows} />
    </div>
  );
}

// ─── Controles ──────────────────────────────────────────────────────────────

function FieldSelect({
  label, value, onChange, options, allowNone, noneLabel, render,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allowNone?: boolean;
  noneLabel?: string;
  render?: (v: string) => string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 pl-2.5 pr-1 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-transparent pr-5 py-0.5 font-medium text-foreground outline-none cursor-pointer max-w-[150px] truncate"
        >
          {allowNone && <option value="">{noneLabel ?? '—'}</option>}
          {options.map((o) => (
            <option key={o} value={o}>{render ? render(o) : o}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </div>
    </label>
  );
}

function Slicer({
  label, options, value, onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const active = value && value !== '__all__';
  return (
    <label className={`inline-flex items-center gap-1.5 rounded-full border pl-3 pr-1 py-1 text-xs transition-colors ${active ? 'border-brand/50 bg-brand/10 text-brand' : 'border-border bg-card text-muted-foreground'}`}>
      <span className="font-medium">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-transparent pr-5 py-0.5 font-medium outline-none cursor-pointer max-w-[130px] truncate text-foreground"
        >
          <option value="__all__">Todos</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-70" aria-hidden />
      </div>
    </label>
  );
}

// ─── KPI ────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} aria-hidden />
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <TrendingUp className="h-3 w-3" style={{ color: accent }} aria-hidden />
        <span className="truncate" title={label}>{label}</span>
      </div>
      <div className="mt-1 text-lg sm:text-2xl font-semibold tabular-nums leading-tight break-words">{value}</div>
    </div>
  );
}

// ─── Tabela de dados ─────────────────────────────────────────────────────────

const PAGE = 12;

function DataTable({ dataset, rows }: { dataset: Dataset; rows: Row[] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const cols = dataset.columns;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = q
      ? rows.filter((r) => Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q)))
      : rows;
    if (sortKey) {
      const col = cols.find((c) => c.name === sortKey);
      const numeric = col?.type === 'number';
      out = [...out].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        let cmp: number;
        if (numeric) cmp = (coerceNumber(av) ?? -Infinity) - (coerceNumber(bv) ?? -Infinity);
        else cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, search, sortKey, sortDir, cols]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  function toggleSort(name: string) {
    if (sortKey === name) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(name); setSortDir('desc'); }
    setPage(0);
  }

  return (
    <Panel title="Dados" subtitle={`${filtered.length.toLocaleString('pt-BR')} linhas`}>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar…"
            className="w-full rounded-lg border border-input bg-muted/40 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-brand transition-colors"
          />
        </div>
        <Table2 className="h-4 w-4 text-muted-foreground ml-auto" aria-hidden />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {cols.map((c) => (
                <th
                  key={c.name}
                  onClick={() => toggleSort(c.name)}
                  className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none"
                  title="Ordenar"
                >
                  {c.name}
                  {sortKey === c.name && <span className="text-brand">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                {cols.map((c) => (
                  <td key={c.name} className="px-3 py-1.5 whitespace-nowrap tabular-nums text-foreground/90 max-w-[220px] truncate" title={r[c.name] == null ? '' : String(r[c.name])}>
                    {c.type === 'number'
                      ? (coerceNumber(r[c.name]) != null ? fmtNumber(coerceNumber(r[c.name])!) : '—')
                      : r[c.name] == null || r[c.name] === '' ? '—' : String(r[c.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {safePage + 1} de {pageCount}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-40 transition-colors">Anterior</button>
            <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-40 transition-colors">Próxima</button>
          </div>
        </div>
      )}
    </Panel>
  );
}
