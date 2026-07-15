'use client';

import { useState } from 'react';
import { Settings2, X, ChevronUp, ChevronDown, TrendingUp, GripVertical } from 'lucide-react';
import type { Dataset, DashboardPlan, Row, Agg } from '@/lib/dashboard/analyze';
import { computePanel, formatFor, PANEL_META, type PanelConfig, type PanelType, type PanelFormat } from '@/lib/dashboard/panels';
import { fmtBy } from '@/lib/dashboard/parse-file';
import { RankBar, ShareDonut, TimeSeriesArea, StackedBars } from './StudioCharts';

const AGG_LABEL: Record<Agg, string> = { sum: 'Soma', mean: 'Média', count: 'Contagem', min: 'Mínimo', max: 'Máximo' };
const TYPES: PanelType[] = ['kpi', 'manualKpi', 'bar', 'donut', 'line', 'stacked', 'table'];
const spanClass = (size?: string) => (size === 'lg' ? 'lg:col-span-2' : size === 'sm' ? '' : '');

export function PanelView({
  cfg, dataset, rows, plan, onChange, onRemove, onMove,
}: {
  cfg: PanelConfig;
  dataset: Dataset;
  rows: Row[];
  plan: DashboardPlan;
  onChange: (next: PanelConfig) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [cfgOpen, setCfgOpen] = useState(false);
  const data = computePanel(cfg, dataset, rows);
  const isKpi = cfg.type === 'kpi' || cfg.type === 'manualKpi';
  const set = (patch: Partial<PanelConfig>) => onChange({ ...cfg, ...patch });

  return (
    <div className={`dashboard-panel group relative rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm ${spanClass(cfg.size)}`}>
      {/* Header: título editável + controles */}
      <div className="mb-3 flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 print-hide" aria-hidden />
        <input
          value={cfg.title}
          onChange={(e) => set({ title: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none focus:text-brand"
          aria-label="Título da peça"
        />
        <div className="flex items-center gap-0.5 print-hide">
          <button onClick={() => onMove(-1)} title="Mover para cima" className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"><ChevronUp className="h-3.5 w-3.5" /></button>
          <button onClick={() => onMove(1)} title="Mover para baixo" className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"><ChevronDown className="h-3.5 w-3.5" /></button>
          <button onClick={() => setCfgOpen((v) => !v)} title="Configurar" className={`rounded p-1 hover:bg-muted ${cfgOpen ? 'text-brand' : 'text-muted-foreground hover:text-foreground'}`}><Settings2 className="h-3.5 w-3.5" /></button>
          <button onClick={onRemove} title="Remover" className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Config */}
      {cfgOpen && (
        <div className="mb-3 flex flex-wrap gap-1.5 rounded-lg border border-border bg-muted/30 p-2 print-hide">
          <Sel label="Tipo" value={cfg.type} onChange={(v) => set({ type: v as PanelType, size: PANEL_META[v as PanelType].wide ? 'lg' : cfg.size })} options={TYPES.map((t) => [t, PANEL_META[t].label])} />
          {cfg.type === 'manualKpi' ? (
            <>
              <label className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs">
                <span className="text-muted-foreground">Valor</span>
                <input type="number" value={cfg.manualValue ?? 0} onChange={(e) => set({ manualValue: Number(e.target.value) })} className="w-24 bg-transparent font-medium text-foreground outline-none" />
              </label>
              <Sel label="Formato" value={cfg.format ?? 'number'} onChange={(v) => set({ format: v as PanelFormat })} options={[['number', 'Número'], ['currency', 'R$'], ['percent', '%']]} />
            </>
          ) : (
            <>
              <Sel label="Medida" value={cfg.measure ?? ''} onChange={(v) => set({ measure: v || null, format: formatFor(v || null) })} options={[['', 'Contagem'], ...plan.measures.map((m) => [m, m] as [string, string])]} />
              {cfg.measure && (cfg.type === 'kpi' || cfg.type === 'bar' || cfg.type === 'donut' || cfg.type === 'line' || cfg.type === 'table') && (
                <Sel label="Como" value={cfg.agg ?? 'sum'} onChange={(v) => set({ agg: v as Agg })} options={(['sum', 'mean', 'max', 'min'] as Agg[]).map((a) => [a, AGG_LABEL[a]])} />
              )}
              {(cfg.type === 'bar' || cfg.type === 'donut' || cfg.type === 'stacked' || cfg.type === 'table') && (
                <Sel label="Por" value={cfg.dimension ?? ''} onChange={(v) => set({ dimension: v || null })} options={[['', '—'], ...plan.dimensions.map((d) => [d, d] as [string, string])]} />
              )}
              {cfg.type === 'stacked' && (
                <Sel label="Cruzar" value={cfg.dimension2 ?? ''} onChange={(v) => set({ dimension2: v || null })} options={[['', '—'], ...plan.dimensions.map((d) => [d, d] as [string, string])]} />
              )}
              {cfg.type === 'line' && (
                <Sel label="Data" value={cfg.dateColumn ?? ''} onChange={(v) => set({ dateColumn: v || null })} options={[['', '—'], ...dataset.columns.filter((c) => c.type === 'date').map((c) => [c.name, c.name] as [string, string])]} />
              )}
            </>
          )}
        </div>
      )}

      {/* Corpo */}
      {isKpi && data.kind === 'kpi' ? (
        <div className="py-2">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-brand" aria-hidden />
          </div>
          <div className="mt-1 text-3xl font-semibold tabular-nums leading-none">{fmtBy(data.format, data.value)}</div>
        </div>
      ) : data.kind === 'empty' ? (
        <p className="py-6 text-center text-xs text-muted-foreground">{data.reason}</p>
      ) : data.kind === 'slices' ? (
        cfg.type === 'donut' ? <ShareDonut data={data.slices} format={data.format} /> : <RankBar data={data.slices} format={data.format} />
      ) : data.kind === 'series' ? (
        <TimeSeriesArea data={data.points} format={data.format} />
      ) : data.kind === 'crosstab' ? (
        <StackedBars crosstab={data.crosstab} format={data.format} />
      ) : data.kind === 'table' ? (
        <MiniTable rows={data.rows} format={data.format} dim={cfg.dimension ?? ''} measure={cfg.measure ?? 'contagem'} />
      ) : null}
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[130px] truncate bg-transparent font-medium text-foreground outline-none cursor-pointer">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function MiniTable({ rows, format, dim, measure }: { rows: Array<{ key: string; value: number; count: number }>; format: PanelFormat; dim: string; measure: string }) {
  if (rows.length === 0) return <p className="py-4 text-center text-xs text-muted-foreground">Sem dados.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{dim || 'Item'}</th>
            <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">{measure}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-1 max-w-[200px] truncate text-foreground/90" title={r.key}>{r.key}</td>
              <td className="px-3 py-1 text-right tabular-nums">{fmtBy(format, r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
