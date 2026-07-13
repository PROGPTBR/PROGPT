'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  ScatterChart, Scatter, ZAxis,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList,
} from 'recharts';
import type { GroupSlice, TimePoint, CrosstabResult } from '@/lib/dashboard/analyze';
import { fmtBy, fmtNumber } from '@/lib/dashboard/parse-file';

// Kit de gráficos "Power BI" do Dashboard Studio — recharts tematizado na
// marca (gradiente cyan→blue) com paleta categórica vibrante. Tudo client-side.

export const PALETTE = [
  '#0ed1e0', '#0e8de1', '#6366f1', '#8b5cf6', '#22c55e', '#f59e0b',
  '#ec4899', '#14b8a6', '#eab308', '#3b82f6', '#a855f7', '#ef4444',
];

const AXIS = '#94a3b8';
const GRID = 'rgba(148,163,184,0.14)';
type Fmt = 'number' | 'currency' | 'percent';

// ─── Chrome compartilhado ───────────────────────────────────────────────────

export function Panel({
  title,
  subtitle,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm ${className}`}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function TooltipBox({
  active, payload, label, format = 'number',
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string | number;
  format?: Fmt;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-xl text-xs">
      {label !== undefined && <div className="mb-1 font-medium text-foreground">{label}</div>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} aria-hidden />
            <span className="text-muted-foreground">{p.name ?? p.dataKey}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">
              {fmtBy(format, Number(p.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const shortTick = (s: unknown) => {
  const str = String(s);
  return str.length > 14 ? str.slice(0, 13) + '…' : str;
};
const monthTick = (s: unknown) => {
  const m = String(s).match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(s);
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${meses[Number(m[2]) - 1]}/${m[1]!.slice(2)}`;
};

// ─── Série temporal (área com gradiente) ───────────────────────────────────

export function TimeSeriesArea({ data, format }: { data: TimePoint[]; format: Fmt }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="studioArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ed1e0" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#0e8de1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="key" tickFormatter={monthTick} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => fmtNumber(Number(v))} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<TooltipBox format={format} />} cursor={{ stroke: '#0ed1e0', strokeOpacity: 0.3 }} />
        <Area type="monotone" dataKey="value" name="Total" stroke="#0ed1e0" strokeWidth={2.5} fill="url(#studioArea)" activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Barras horizontais (ranking top-N) ─────────────────────────────────────

export function RankBar({ data, format }: { data: GroupSlice[]; format: Fmt }) {
  const height = Math.max(200, data.length * 34);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => fmtNumber(Number(v))} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="key" tickFormatter={shortTick} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={104} />
        <Tooltip content={<TooltipBox format={format} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Bar dataKey="value" name="Total" radius={[0, 6, 6, 0]} maxBarSize={26}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
          <LabelList dataKey="value" position="right" formatter={(v: number) => fmtBy(format, v)} className="fill-muted-foreground" style={{ fontSize: 10 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Rosca (participação) ───────────────────────────────────────────────────

export function ShareDonut({ data, format }: { data: GroupSlice[]; format: Fmt }) {
  const total = useMemo(() => data.reduce((a, s) => a + s.value, 0), [data]);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="key" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={1.5} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-lg border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: payload[0]!.color }} aria-hidden />
                  <span className="text-muted-foreground">{payload[0]!.name}</span>
                  <span className="ml-auto font-semibold tabular-nums text-foreground">
                    {fmtBy(format, Number(payload[0]!.value ?? 0))}
                    {total > 0 && (
                      <span className="text-muted-foreground font-normal">
                        {' · '}{((Number(payload[0]!.value ?? 0) / total) * 100).toFixed(0)}%
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ) : null
          }
        />
        <Legend
          verticalAlign="middle" align="right" layout="vertical" iconType="circle" iconSize={8}
          formatter={(v) => <span className="text-[11px] text-muted-foreground">{shortTick(v)}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Barras empilhadas (dimensão × dimensão) ────────────────────────────────

export function StackedBars({ crosstab, format }: { crosstab: CrosstabResult; format: Fmt }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={crosstab.stacked} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="dim" tickFormatter={shortTick} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={54} />
        <YAxis tickFormatter={(v) => fmtNumber(Number(v))} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<TooltipBox format={format} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-[11px] text-muted-foreground">{shortTick(v)}</span>} />
        {crosstab.colKeys.map((ck, i) => (
          <Bar key={ck} dataKey={ck} name={ck} stackId="a" fill={PALETTE[i % PALETTE.length]} maxBarSize={54} radius={i === crosstab.colKeys.length - 1 ? [5, 5, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Dispersão / bolha (medida × medida) ────────────────────────────────────

export function BubbleScatter({
  data, xName, yName, format,
}: {
  data: Array<{ x: number; y: number; label: string }>;
  xName: string;
  yName: string;
  format: Fmt;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 10, right: 16, left: 4, bottom: 16 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="x" name={xName} tickFormatter={(v) => fmtNumber(Number(v))} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false}>
        </XAxis>
        <YAxis type="number" dataKey="y" name={yName} tickFormatter={(v) => fmtNumber(Number(v))} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
        <ZAxis type="number" range={[30, 260]} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3', stroke: '#0ed1e0' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-lg border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-xl text-xs space-y-0.5">
                {payload[0]?.payload?.label && <div className="font-medium text-foreground">{payload[0].payload.label}</div>}
                <div className="text-muted-foreground">{xName}: <span className="text-foreground font-semibold">{fmtBy(format, Number(payload[0]?.payload?.x ?? 0))}</span></div>
                <div className="text-muted-foreground">{yName}: <span className="text-foreground font-semibold">{fmtNumber(Number(payload[0]?.payload?.y ?? 0))}</span></div>
              </div>
            ) : null
          }
        />
        <Scatter data={data} fill="#0e8de1" fillOpacity={0.55} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ─── Radar (perfil multidimensional) ────────────────────────────────────────

export function ProfileRadar({ data, format }: { data: GroupSlice[]; format: Fmt }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="key" tickFormatter={shortTick} tick={{ fill: AXIS, fontSize: 10 }} />
        <PolarRadiusAxis tick={{ fill: AXIS, fontSize: 9 }} tickFormatter={(v) => fmtNumber(Number(v))} axisLine={false} />
        <Radar dataKey="value" name="Total" stroke="#0ed1e0" fill="#0ed1e0" fillOpacity={0.28} strokeWidth={2} />
        <Tooltip content={<TooltipBox format={format} />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── Heatmap (matriz dim × dim) ─────────────────────────────────────────────

export function Heatmap({ crosstab, format }: { crosstab: CrosstabResult; format: Fmt }) {
  const max = useMemo(() => {
    let m = 0;
    for (const rk of crosstab.rowKeys) for (const ck of crosstab.colKeys) m = Math.max(m, crosstab.matrix[rk]?.[ck] ?? 0);
    return m || 1;
  }, [crosstab]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-card" />
            {crosstab.colKeys.map((ck) => (
              <th key={ck} className="px-1 pb-1 text-[10px] font-medium text-muted-foreground text-center max-w-[70px] truncate" title={ck}>
                {shortTick(ck)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crosstab.rowKeys.map((rk) => (
            <tr key={rk}>
              <td className="sticky left-0 bg-card pr-2 text-[11px] font-medium text-foreground max-w-[120px] truncate" title={rk}>
                {shortTick(rk)}
              </td>
              {crosstab.colKeys.map((ck) => {
                const v = crosstab.matrix[rk]?.[ck] ?? 0;
                const t = v / max;
                return (
                  <td key={ck} className="text-center">
                    <div
                      className="rounded-md py-2 text-[10px] font-semibold tabular-nums transition-transform hover:scale-105"
                      style={{
                        background: `rgba(14, 141, 225, ${0.08 + t * 0.82})`,
                        color: t > 0.5 ? '#fff' : 'hsl(var(--muted-foreground))',
                      }}
                      title={`${rk} · ${ck}: ${fmtBy(format, v)}`}
                    >
                      {v > 0 ? fmtNumber(v) : '·'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
