import {
  type Dataset, type DashboardPlan, type Agg,
  groupBy, topN, timeSeries, crosstab, coerceNumber,
  looksLikeMoney, looksLikePercent,
} from './analyze';

// Modelo de "peças" (painéis) do construtor de dashboard. O usuário monta a
// tela adicionando peças da barra lateral, configura cada uma (medida/dimensão/
// tipo) e pode incluir KPIs com número DIGITADO À MÃO (dados que não estavam na
// planilha). O layout é uma lista de PanelConfig — serializável (salva no banco).

export type PanelType =
  | 'kpi'         // KPI automático (agrega uma medida)
  | 'manualKpi'   // KPI com número digitado pelo usuário
  | 'bar'         // ranking (barras horizontais) por dimensão
  | 'donut'       // participação por dimensão
  | 'line'        // série temporal (por data)
  | 'stacked'     // barras empilhadas (dim × dim)
  | 'table';      // tabela agregada (dimensão × medida)

export type PanelFormat = 'number' | 'currency' | 'percent';

export type PanelConfig = {
  id: string;
  type: PanelType;
  title: string;
  measure?: string | null;
  agg?: Agg;
  dimension?: string | null;
  dimension2?: string | null;
  dateColumn?: string | null;
  manualValue?: number;
  format?: PanelFormat;
  size?: 'sm' | 'md' | 'lg'; // largura no grid (1 / 1 / 2 colunas)
};

export const PANEL_META: Record<PanelType, { label: string; icon: string; wide?: boolean }> = {
  kpi: { label: 'Indicador (KPI)', icon: 'gauge' },
  manualKpi: { label: 'Número manual', icon: 'pencil' },
  bar: { label: 'Ranking (barras)', icon: 'barChart3' },
  donut: { label: 'Participação (rosca)', icon: 'pieChart' },
  line: { label: 'Evolução (linha)', icon: 'lineChart', wide: true },
  stacked: { label: 'Empilhado (cruzamento)', icon: 'layers', wide: true },
  table: { label: 'Tabela', icon: 'table', wide: true },
};

let seq = 0;
export function panelId(): string {
  seq += 1;
  return `p_${seq}_${Math.floor(performance.now?.() ?? 0)}`;
}

export function formatFor(name: string | null | undefined): PanelFormat {
  if (!name) return 'number';
  return looksLikeMoney(name) ? 'currency' : looksLikePercent(name) ? 'percent' : 'number';
}

// Cria uma peça nova (ao clicar na barra lateral) com defaults sensatos.
export function newPanel(type: PanelType, plan: DashboardPlan): PanelConfig {
  const base: PanelConfig = { id: panelId(), type, title: PANEL_META[type].label, size: PANEL_META[type].wide ? 'lg' : 'md' };
  const m = plan.primaryMeasure;
  const d = plan.primaryDimension;
  switch (type) {
    case 'kpi':
      return { ...base, title: m ? `Total · ${m}` : 'Contagem', measure: m, agg: 'sum', format: formatFor(m) };
    case 'manualKpi':
      return { ...base, title: 'Novo indicador', manualValue: 0, format: 'number' };
    case 'bar':
      return { ...base, title: d ? `Ranking por ${d}` : 'Ranking', measure: m, dimension: d, agg: 'sum', format: formatFor(m) };
    case 'donut':
      return { ...base, title: d ? `Participação por ${d}` : 'Participação', measure: m, dimension: d, agg: 'sum', format: formatFor(m) };
    case 'line':
      return { ...base, title: 'Evolução no tempo', measure: m, dateColumn: plan.dateColumn, agg: 'sum', format: formatFor(m) };
    case 'stacked':
      return { ...base, title: 'Cruzamento', measure: m, dimension: d, dimension2: plan.secondaryDimension, format: formatFor(m) };
    case 'table':
      return { ...base, title: d ? `${d} × ${m ?? 'contagem'}` : 'Tabela', measure: m, dimension: d, agg: 'sum', format: formatFor(m) };
    default:
      return base;
  }
}

// Seed inicial de painéis a partir do "plano" detectado no upload — reproduz o
// dashboard automático como peças editáveis (o usuário parte daí e customiza).
export function seedPanelsFromPlan(plan: DashboardPlan): PanelConfig[] {
  const out: PanelConfig[] = [];
  const m = plan.primaryMeasure;
  const d = plan.primaryDimension;
  const d2 = plan.secondaryDimension;
  const fmt = formatFor(m);

  if (m) out.push({ id: panelId(), type: 'kpi', title: `Total · ${m}`, measure: m, agg: 'sum', format: fmt, size: 'sm' });
  out.push({ id: panelId(), type: 'kpi', title: 'Registros', measure: null, agg: 'count', format: 'number', size: 'sm' });
  if (plan.dateColumn && m) out.push({ id: panelId(), type: 'line', title: `Evolução · ${m}`, measure: m, dateColumn: plan.dateColumn, agg: 'sum', format: fmt, size: 'lg' });
  if (d) out.push({ id: panelId(), type: 'bar', title: `Ranking por ${d}`, measure: m, dimension: d, agg: 'sum', format: fmt, size: 'md' });
  if (d2 ?? d) out.push({ id: panelId(), type: 'donut', title: `Participação por ${d2 ?? d}`, measure: m, dimension: d2 ?? d, agg: 'sum', format: fmt, size: 'md' });
  if (d && d2) out.push({ id: panelId(), type: 'stacked', title: `${d} × ${d2}`, measure: m, dimension: d, dimension2: d2, format: fmt, size: 'lg' });
  if (d) out.push({ id: panelId(), type: 'table', title: `${d} × ${m ?? 'contagem'}`, measure: m, dimension: d, agg: 'sum', format: fmt, size: 'lg' });
  return out;
}

// ─── Cálculo dos dados de cada peça (puro, reusa o engine analyze) ──────────

export type PanelData =
  | { kind: 'kpi'; value: number; format: PanelFormat }
  | { kind: 'slices'; slices: Array<{ key: string; value: number; count: number }>; format: PanelFormat }
  | { kind: 'series'; points: Array<{ key: string; value: number; count: number }>; format: PanelFormat }
  | { kind: 'crosstab'; crosstab: ReturnType<typeof crosstab>; format: PanelFormat }
  | { kind: 'table'; rows: Array<{ key: string; value: number; count: number }>; format: PanelFormat }
  | { kind: 'empty'; reason: string };

export function computePanel(cfg: PanelConfig, dataset: Dataset, rows = dataset.rows): PanelData {
  const fmt = cfg.format ?? formatFor(cfg.measure);
  const agg: Agg = cfg.measure ? cfg.agg ?? 'sum' : 'count';

  switch (cfg.type) {
    case 'manualKpi':
      return { kind: 'kpi', value: cfg.manualValue ?? 0, format: cfg.format ?? 'number' };
    case 'kpi': {
      if (!cfg.measure) return { kind: 'kpi', value: rows.length, format: 'number' };
      let total = 0, count = 0, min = Infinity, max = -Infinity;
      for (const r of rows) {
        const n = coerceNumber(r[cfg.measure]);
        if (n != null) { total += n; count += 1; min = Math.min(min, n); max = Math.max(max, n); }
      }
      const value =
        agg === 'mean' ? (count ? total / count : 0)
        : agg === 'max' ? (max === -Infinity ? 0 : max)
        : agg === 'min' ? (min === Infinity ? 0 : min)
        : agg === 'count' ? count
        : total;
      return { kind: 'kpi', value, format: fmt };
    }
    case 'bar':
    case 'donut': {
      if (!cfg.dimension) return { kind: 'empty', reason: 'Escolha uma dimensão' };
      const slices = topN(groupBy(rows, cfg.dimension, cfg.measure ?? null, agg), cfg.type === 'donut' ? 7 : 10);
      return { kind: 'slices', slices, format: fmt };
    }
    case 'line': {
      if (!cfg.dateColumn) return { kind: 'empty', reason: 'Escolha uma coluna de data' };
      const points = timeSeries(rows, cfg.dateColumn, cfg.measure ?? null, agg);
      if (points.length < 2) return { kind: 'empty', reason: 'Sem histórico suficiente' };
      return { kind: 'series', points, format: fmt };
    }
    case 'stacked': {
      if (!cfg.dimension || !cfg.dimension2) return { kind: 'empty', reason: 'Escolha duas dimensões' };
      return { kind: 'crosstab', crosstab: crosstab(rows, cfg.dimension, cfg.dimension2, cfg.measure ?? null), format: fmt };
    }
    case 'table': {
      if (!cfg.dimension) return { kind: 'empty', reason: 'Escolha uma dimensão' };
      return { kind: 'table', rows: topN(groupBy(rows, cfg.dimension, cfg.measure ?? null, agg), 20), format: fmt };
    }
    default:
      return { kind: 'empty', reason: 'Peça não configurada' };
  }
}
