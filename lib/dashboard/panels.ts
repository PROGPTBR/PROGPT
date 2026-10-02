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
  | 'heatmap'     // matriz dim × dim com cor por intensidade (formatação condicional)
  | 'gauge'       // velocímetro: um percentual contra uma meta
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
  /**
   * Valor da dimensão que conta como "sim" numa taxa (ex.: dimensão
   * "Entregue no prazo", valor "Sim" → o painel vira o % de linhas no prazo).
   * É o que permite medir taxa de atendimento sem ter uma coluna de percentual
   * pronta na planilha — o caso normal de uma base de pedidos.
   */
  matchValue?: string | null;
  /** Com `matchValue`: mostrar a quantidade de linhas ou o percentual delas. */
  rateMode?: 'count' | 'percent';
  /**
   * Recorte só desta peça (ex.: o velocímetro mede a taxa no prazo APENAS dos
   * pedidos críticos, enquanto o resto do painel continua olhando a carteira
   * inteira). Vazio = usa todas as linhas que passaram pelo filtro global.
   */
  filterColumn?: string | null;
  filterValue?: string | null;
  /** Meta do velocímetro, em % (padrão 95). */
  goal?: number;
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
  heatmap: { label: 'Matriz (heatmap)', icon: 'grid3x3', wide: true },
  gauge: { label: 'Velocímetro (meta)', icon: 'gaugeCircle' },
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
    case 'heatmap':
      return {
        ...base,
        title: 'Matriz',
        measure: m,
        agg: 'mean',
        dimension: d,
        dimension2: plan.secondaryDimension,
        format: formatFor(m),
      };
    case 'gauge':
      return { ...base, title: 'Taxa', dimension: d, matchValue: null, goal: 95, format: 'percent' };
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
  | { kind: 'matrix'; crosstab: ReturnType<typeof crosstab>; format: PanelFormat }
  | { kind: 'gauge'; value: number; goal: number; matched: number; total: number; format: PanelFormat }
  | { kind: 'table'; rows: Array<{ key: string; value: number; count: number }>; format: PanelFormat }
  | { kind: 'empty'; reason: string };

/**
 * Taxa a partir de um par (dimensão, valor): quantas linhas batem, sobre o
 * total. Devolve null quando o painel não está configurado assim.
 */
function rateOf(
  cfg: PanelConfig,
  rows: Dataset['rows'],
): { pct: number; matched: number; total: number } | null {
  if (!cfg.dimension || !cfg.matchValue) return null;

  const alvo = cfg.matchValue.trim().toLowerCase();
  let matched = 0;
  let total = 0;

  for (const r of rows) {
    const raw = r[cfg.dimension];
    if (raw == null || String(raw).trim() === '') continue; // vazio não entra na conta
    total += 1;
    if (String(raw).trim().toLowerCase() === alvo) matched += 1;
  }

  return { pct: total ? (matched / total) * 100 : 0, matched, total };
}

/** Recorte da peça: mantém só as linhas cuja coluna bate com o valor escolhido. */
export function applyPanelFilter(cfg: PanelConfig, rows: Dataset['rows']): Dataset['rows'] {
  if (!cfg.filterColumn || !cfg.filterValue) return rows;
  const alvo = cfg.filterValue.trim().toLowerCase();
  return rows.filter((r) => String(r[cfg.filterColumn!] ?? '').trim().toLowerCase() === alvo);
}

export function computePanel(cfg: PanelConfig, dataset: Dataset, allRows = dataset.rows): PanelData {
  const rows = applyPanelFilter(cfg, allRows);
  const fmt = cfg.format ?? formatFor(cfg.measure);
  const agg: Agg = cfg.measure ? cfg.agg ?? 'sum' : 'count';

  switch (cfg.type) {
    case 'manualKpi':
      return { kind: 'kpi', value: cfg.manualValue ?? 0, format: cfg.format ?? 'number' };
    case 'kpi': {
      // Taxa: % de linhas cuja dimensão bate com o valor escolhido. Vem antes
      // da medida porque "taxa de atendimento no prazo" não é a média de uma
      // coluna — é a fatia das linhas marcadas como no prazo.
      const rate = rateOf(cfg, rows);
      if (rate) {
        return cfg.rateMode === 'count'
          ? { kind: 'kpi', value: rate.matched, format: 'number' }
          : { kind: 'kpi', value: rate.pct, format: 'percent' };
      }
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
    case 'heatmap': {
      if (!cfg.dimension || !cfg.dimension2) return { kind: 'empty', reason: 'Escolha as duas dimensões do cruzamento' };
      return {
        kind: 'matrix',
        crosstab: crosstab(rows, cfg.dimension, cfg.dimension2, cfg.measure ?? null, { agg }),
        format: fmt,
      };
    }
    case 'gauge': {
      const rate = rateOf(cfg, rows);
      if (rate) {
        return { kind: 'gauge', value: rate.pct, goal: cfg.goal ?? 95, matched: rate.matched, total: rate.total, format: 'percent' };
      }
      if (!cfg.measure) return { kind: 'empty', reason: 'Escolha a coluna e o valor que contam como atendido' };
      // Sem par dimensão/valor, cai na média de uma coluna já percentual.
      let total = 0, count = 0;
      for (const r of rows) {
        const n = coerceNumber(r[cfg.measure]);
        if (n != null) { total += n; count += 1; }
      }
      const mean = count ? total / count : 0;
      return {
        kind: 'gauge',
        value: Math.abs(mean) <= 1 ? mean * 100 : mean,
        goal: cfg.goal ?? 95,
        matched: count,
        total: rows.length,
        format: 'percent',
      };
    }
    case 'table': {
      if (!cfg.dimension) return { kind: 'empty', reason: 'Escolha uma dimensão' };
      return { kind: 'table', rows: topN(groupBy(rows, cfg.dimension, cfg.measure ?? null, agg), 20), format: fmt };
    }
    default:
      return { kind: 'empty', reason: 'Peça não configurada' };
  }
}
