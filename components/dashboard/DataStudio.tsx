'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Upload, Sparkles, X, RefreshCw, Filter, FileDown, CalendarRange, Search,
  ChevronDown, LayoutDashboard, Plus, Save, FolderOpen, Trash2,
  Gauge, Pencil, BarChart3, PieChart, LineChart, Layers, Table as TableIcon, Loader2, Package,
} from 'lucide-react';
import {
  buildDataset, planDashboard, groupBy, keyOf, coerceNumber, coerceDate,
  type Dataset, type Row,
} from '@/lib/dashboard/analyze';
import { parseSpreadsheetFile, fmtNumber } from '@/lib/dashboard/parse-file';
import { sampleDataset } from '@/lib/dashboard/sample';
import { getTemplates } from '@/lib/dashboard/templates';
import {
  seedPanelsFromPlan, newPanel, PANEL_META, type PanelConfig, type PanelType,
} from '@/lib/dashboard/panels';
import {
  listDashboards, saveDashboard, loadDashboard, deleteDashboard,
  type DashboardListItem,
} from '@/lib/dashboard/store';
import { PanelView } from './PanelView';

type Loaded = { dataset: Dataset; sourceName: string; panels: PanelConfig[]; name: string; id: string | null };

const PALETTE: Array<{ type: PanelType; Icon: typeof Gauge }> = [
  { type: 'kpi', Icon: Gauge },
  { type: 'manualKpi', Icon: Pencil },
  { type: 'bar', Icon: BarChart3 },
  { type: 'donut', Icon: PieChart },
  { type: 'line', Icon: LineChart },
  { type: 'stacked', Icon: Layers },
  { type: 'table', Icon: TableIcon },
];

export function DataStudio() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const applyRows = useCallback(
    (rows: Row[], name: string, opts?: { panels?: PanelConfig[]; dashName?: string; id?: string | null }) => {
      if (rows.length === 0 && !opts?.panels?.length) {
        toast.error('A planilha parece vazia ou sem cabeçalho reconhecível.');
        return;
      }
      const dataset = buildDataset(rows);
      const plan = planDashboard(dataset.columns);
      setLoaded({
        dataset,
        sourceName: name,
        panels: opts?.panels ?? seedPanelsFromPlan(plan),
        name: opts?.dashName ?? name,
        id: opts?.id ?? null,
      });
    },
    [],
  );

  const onFile = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const parsed = await parseSpreadsheetFile(file);
        applyRows(parsed.rows, parsed.name);
        toast.success(`${parsed.rows.length.toLocaleString('pt-BR')} linhas carregadas.`);
      } catch (err) {
        console.error(err);
        toast.error('Não consegui ler o arquivo. Use .xlsx, .csv ou .tsv.');
      } finally {
        setLoading(false);
      }
    },
    [applyRows],
  );

  const loadSample = useCallback(() => {
    const s = sampleDataset();
    applyRows(s.rows, s.name);
  }, [applyRows]);

  const loadTemplate = useCallback(
    (key: string) => {
      const t = getTemplates().find((x) => x.key === key);
      if (t) applyRows(t.rows, t.name, { panels: t.panels, dashName: t.name });
    },
    [applyRows],
  );

  const openSaved = useCallback(
    async (id: string) => {
      setLoading(true);
      const sd = await loadDashboard(id);
      setLoading(false);
      if (!sd) {
        toast.error('Não foi possível abrir o dashboard.');
        return;
      }
      applyRows(sd.rows, sd.sourceName ?? sd.name, { panels: sd.panels, dashName: sd.name, id: sd.id });
    },
    [applyRows],
  );

  if (!loaded) {
    return (
      <UploadHero
        loading={loading}
        dragOver={dragOver}
        setDragOver={setDragOver}
        inputRef={inputRef}
        onFile={onFile}
        onSample={loadSample}
        onTemplate={loadTemplate}
        onOpenSaved={openSaved}
      />
    );
  }

  return (
    <Builder
      loaded={loaded}
      setLoaded={setLoaded}
      onReplace={() => inputRef.current?.click()}
      onNew={() => setLoaded(null)}
      onOpenSaved={openSaved}
      inputRef={inputRef}
      onFile={onFile}
    />
  );
}

// ─── Tela inicial (upload / template / abrir salvo) ─────────────────────────

function UploadHero({
  loading, dragOver, setDragOver, inputRef, onFile, onSample, onTemplate, onOpenSaved,
}: {
  loading: boolean;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
  onSample: () => void;
  onTemplate: (key: string) => void;
  onOpenSaved: (id: string) => void;
}) {
  const [saved, setSaved] = useState<DashboardListItem[]>([]);
  useEffect(() => { void listDashboards().then(setSaved); }, []);

  return (
    <div className="mx-auto max-w-2xl text-center py-6 sm:py-10">
      <div className="inline-flex items-center gap-2 text-brand">
        <LayoutDashboard className="h-5 w-5" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wider">Dashboard</span>
      </div>
      <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
        Monte seu <span className="text-brand-gradient">painel</span>.
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-sm sm:text-base text-muted-foreground">
        Suba uma planilha e o básico é montado sozinho. Depois adicione telas pela
        barra lateral, inclua números que não estavam no arquivo e crie algo único.
      </p>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
        className={`mt-8 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 transition-all ${
          dragOver ? 'border-brand bg-brand/5 scale-[1.01]' : 'border-border bg-card hover:border-brand/50'
        }`}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-soft">
          {loading ? <RefreshCw className="h-6 w-6 animate-spin text-brand" aria-hidden /> : <Upload className="h-6 w-6 text-brand" aria-hidden />}
        </span>
        <span className="text-sm font-medium text-foreground">
          {loading ? 'Processando…' : 'Arraste a planilha aqui ou clique para escolher'}
        </span>
        <span className="text-xs text-muted-foreground">.xlsx · .csv · .tsv</span>
        <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
        <button onClick={onSample} className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-black px-4 py-2 font-semibold hover:brightness-110 active:scale-95 transition-all">
          <Sparkles className="h-4 w-4" aria-hidden /> Dados de exemplo
        </button>
        {getTemplates().map((t) => (
          <button key={t.key} onClick={() => onTemplate(t.key)} title={t.description} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 font-medium hover:border-brand/40 hover:text-brand transition-colors">
            <Package className="h-4 w-4 text-brand" aria-hidden /> Template: {t.name}
          </button>
        ))}
      </div>

      {saved.length > 0 && (
        <div className="mt-8 text-left">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meus dashboards</h3>
          <div className="space-y-1.5">
            {saved.slice(0, 8).map((s) => (
              <button key={s.id} onClick={() => onOpenSaved(s.id)} className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:border-brand/40 transition-colors">
                <FolderOpen className="h-4 w-4 text-brand shrink-0" aria-hidden />
                <span className="flex-1 truncate font-medium">{s.name}</span>
                {s.local && <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">local</span>}
                <span className="text-[11px] text-muted-foreground">{new Date(s.updatedAt).toLocaleDateString('pt-BR')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Construtor ─────────────────────────────────────────────────────────────

const RANGES: Array<{ key: RangeKey; label: string; daysBack: number }> = [
  { key: 'all', label: 'Tudo', daysBack: -1 },
  { key: 'today', label: 'Hoje', daysBack: 0 },
  { key: '2d', label: '2 dias', daysBack: 1 },
  { key: '7d', label: '7 dias', daysBack: 6 },
  { key: '30d', label: '30 dias', daysBack: 29 },
];
type RangeKey = 'all' | 'today' | '2d' | '7d' | '30d';

function isoMinusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d! - days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function Builder({
  loaded, setLoaded, onReplace, onNew, onOpenSaved, inputRef, onFile,
}: {
  loaded: Loaded;
  setLoaded: React.Dispatch<React.SetStateAction<Loaded | null>>;
  onReplace: () => void;
  onNew: () => void;
  onOpenSaved: (id: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
}) {
  const { dataset, panels } = loaded;
  const plan = useMemo(() => planDashboard(dataset.columns), [dataset]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [range, setRange] = useState<RangeKey>('all');
  const [saving, setSaving] = useState(false);
  const [savedList, setSavedList] = useState<DashboardListItem[]>([]);
  const [openMenu, setOpenMenu] = useState(false);

  useEffect(() => { setFilters({}); setRange('all'); }, [dataset]);
  const refreshList = useCallback(() => { void listDashboards().then(setSavedList); }, []);
  useEffect(() => { refreshList(); }, [refreshList]);

  const dateCol = plan.dateColumn;
  const anchorDate = useMemo(
    () => (dateCol ? dataset.columns.find((c) => c.name === dateCol)?.maxDate ?? null : null),
    [dataset.columns, dateCol],
  );
  const rangeThreshold = useMemo(() => {
    if (!anchorDate || range === 'all') return null;
    const cfg = RANGES.find((r) => r.key === range);
    return cfg ? isoMinusDays(anchorDate, cfg.daysBack) : null;
  }, [anchorDate, range]);

  const rows = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v && v !== '__all__');
    if (active.length === 0 && !rangeThreshold) return dataset.rows;
    return dataset.rows.filter((r) => {
      if (!active.every(([col, val]) => keyOf(r[col]) === val)) return false;
      if (rangeThreshold && dateCol) {
        const iso = coerceDate(r[dateCol]);
        if (!iso || iso < rangeThreshold) return false;
      }
      return true;
    });
  }, [dataset.rows, filters, rangeThreshold, dateCol]);

  const slicerDims = plan.dimensions.slice(0, 3);

  // Ops de peças
  const setPanels = (fn: (p: PanelConfig[]) => PanelConfig[]) => setLoaded((l) => (l ? { ...l, panels: fn(l.panels) } : l));
  const addPanel = (type: PanelType) => setPanels((p) => [...p, newPanel(type, plan)]);
  const updatePanel = (id: string, next: PanelConfig) => setPanels((p) => p.map((x) => (x.id === id ? next : x)));
  const removePanel = (id: string) => setPanels((p) => p.filter((x) => x.id !== id));
  const movePanel = (id: string, dir: -1 | 1) =>
    setPanels((p) => {
      const i = p.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const copy = [...p];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });

  async function save() {
    setSaving(true);
    try {
      const sd = await saveDashboard({
        id: loaded.id ?? undefined,
        name: loaded.name || 'Meu dashboard',
        sourceName: loaded.sourceName,
        columns: dataset.columns,
        rows: dataset.rows,
        panels,
      });
      setLoaded((l) => (l ? { ...l, id: sd.id } : l));
      refreshList();
      toast.success('Dashboard salvo.');
    } catch {
      toast.error('Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await deleteDashboard(id);
    refreshList();
    if (id === loaded.id) setLoaded((l) => (l ? { ...l, id: null } : l));
    toast.success('Dashboard removido.');
  }

  return (
    <div className="space-y-5">
      {/* Capa de impressão */}
      <div className="print-cover hidden mb-6 border-b border-border pb-4">
        <div className="text-xs font-medium uppercase tracking-wider text-brand">PROGPT · Painel</div>
        <div className="mt-1 text-2xl font-bold">{loaded.name}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{rows.length.toLocaleString('pt-BR')} linhas</div>
      </div>

      {/* Cabeçalho */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-brand">
            <LayoutDashboard className="h-5 w-5" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wider">Dashboard</span>
          </div>
          <input
            value={loaded.name}
            onChange={(e) => setLoaded((l) => (l ? { ...l, name: e.target.value } : l))}
            className="mt-1 w-full max-w-md bg-transparent text-2xl sm:text-3xl font-semibold tracking-tight outline-none focus:text-brand"
            aria-label="Nome do dashboard"
          />
          <p className="mt-0.5 text-sm text-muted-foreground">
            {dataset.rows.length.toLocaleString('pt-BR')} linhas · {panels.length} peças
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print-hide">
          <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          <div className="relative">
            <button onClick={() => setOpenMenu((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-brand/40 hover:text-brand transition-colors">
              <FolderOpen className="h-4 w-4" aria-hidden /> Meus dashboards <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {openMenu && (
              <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                {savedList.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum salvo ainda.</p>
                ) : (
                  savedList.map((s) => (
                    <div key={s.id} className="flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-muted">
                      <button onClick={() => { setOpenMenu(false); onOpenSaved(s.id); }} className="flex-1 truncate text-left text-sm">{s.name}</button>
                      {s.local && <span className="text-[10px] rounded bg-muted px-1 text-muted-foreground">local</span>}
                      <button onClick={() => remove(s.id)} title="Remover" className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))
                )}
                <button onClick={() => { setOpenMenu(false); onNew(); }} className="mt-1 flex w-full items-center gap-1.5 rounded-lg border-t border-border px-3 py-2 text-sm text-brand hover:bg-brand/10">
                  <Plus className="h-4 w-4" /> Novo dashboard
                </button>
              </div>
            )}
          </div>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-black px-4 py-2 text-sm font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-brand/40 hover:text-brand transition-colors">
            <FileDown className="h-4 w-4" aria-hidden /> PDF
          </button>
          <button onClick={onReplace} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium hover:border-brand/40 hover:text-brand transition-colors">
            <Upload className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      {/* Paleta de peças */}
      <div className="print-hide flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground pr-1">
          <Plus className="h-3.5 w-3.5 text-brand" aria-hidden /> Adicionar peça
        </span>
        {PALETTE.map(({ type, Icon }) => (
          <button key={type} onClick={() => addPanel(type)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-brand/50 hover:text-brand transition-colors">
            <Icon className="h-3.5 w-3.5" aria-hidden /> {PANEL_META[type].label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      {(slicerDims.length > 0 || (dateCol && anchorDate)) && (
        <div className="print-hide flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Filter className="h-3.5 w-3.5 text-brand" aria-hidden /> Filtros
          </span>
          {slicerDims.map((d) => (
            <Slicer key={d} label={d} options={groupBy(dataset.rows, d, null).map((s) => s.key).slice(0, 60)} value={filters[d] ?? '__all__'} onChange={(v) => setFilters((f) => ({ ...f, [d]: v }))} />
          ))}
          {dateCol && anchorDate && (
            <div className="ml-auto">
              <RangeControl value={range} onChange={setRange} />
            </div>
          )}
          {Object.values(filters).some((v) => v && v !== '__all__') && (
            <button onClick={() => setFilters({})} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-3 w-3" aria-hidden /> Limpar
            </button>
          )}
        </div>
      )}

      {/* Grid de peças */}
      {panels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Nenhuma peça. Adicione telas pela barra acima.
        </div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {panels.map((cfg) => (
            <PanelView
              key={cfg.id}
              cfg={cfg}
              dataset={dataset}
              rows={rows}
              plan={plan}
              onChange={(next) => updatePanel(cfg.id, next)}
              onRemove={() => removePanel(cfg.id)}
              onMove={(dir) => movePanel(cfg.id, dir)}
            />
          ))}
        </section>
      )}

      <DataTable dataset={dataset} rows={rows} />
    </div>
  );
}

// ─── Controles compartilhados ───────────────────────────────────────────────

function Slicer({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const active = value && value !== '__all__';
  return (
    <label className={`group inline-flex items-center gap-1.5 rounded-full border pl-3 pr-2 py-1.5 text-xs shadow-sm transition-colors ${active ? 'border-brand/50 bg-brand/10' : 'border-border bg-background/60 hover:border-brand/40'}`}>
      <span className={`font-medium ${active ? 'text-brand' : 'text-muted-foreground'}`}>{label}</span>
      <div className="relative flex items-center">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none bg-transparent pr-4 font-semibold outline-none cursor-pointer max-w-[130px] truncate text-foreground">
          <option value="__all__">Todos</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className={`pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${active ? 'text-brand' : 'text-muted-foreground'}`} aria-hidden />
      </div>
    </label>
  );
}

function RangeControl({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background/60 p-0.5 shadow-sm">
      <CalendarRange className="ml-1.5 mr-0.5 h-3.5 w-3.5 text-brand" aria-hidden />
      {RANGES.map((r) => (
        <button key={r.key} onClick={() => onChange(r.key)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${value === r.key ? 'bg-brand-gradient text-black shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          {r.label}
        </button>
      ))}
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
    let out = q ? rows.filter((r) => Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q))) : rows;
    if (sortKey) {
      const col = cols.find((c) => c.name === sortKey);
      const numeric = col?.type === 'number';
      out = [...out].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const cmp = numeric ? (coerceNumber(av) ?? -Infinity) - (coerceNumber(bv) ?? -Infinity) : String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR');
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

  if (cols.length === 0) return null;

  return (
    <div className="dashboard-panel rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Dados <span className="text-muted-foreground font-normal">· {filtered.length.toLocaleString('pt-BR')} linhas</span></h3>
        <div className="relative max-w-xs print-hide">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar…" className="w-full rounded-lg border border-input bg-muted/40 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-brand transition-colors" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {cols.map((c) => (
                <th key={c.name} onClick={() => toggleSort(c.name)} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none" title="Ordenar">
                  {c.name}{sortKey === c.name && <span className="text-brand">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                {cols.map((c) => (
                  <td key={c.name} className="px-3 py-1.5 whitespace-nowrap tabular-nums text-foreground/90 max-w-[220px] truncate" title={r[c.name] == null ? '' : String(r[c.name])}>
                    {c.type === 'number' ? (coerceNumber(r[c.name]) != null ? fmtNumber(coerceNumber(r[c.name])!) : '—') : r[c.name] == null || r[c.name] === '' ? '—' : String(r[c.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground print-hide">
          <span>Página {safePage + 1} de {pageCount}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-40 transition-colors">Anterior</button>
            <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-40 transition-colors">Próxima</button>
          </div>
        </div>
      )}
    </div>
  );
}
