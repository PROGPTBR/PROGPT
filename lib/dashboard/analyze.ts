// Dashboard "estúdio de dados" — engine de perfilagem + agregação de uma
// planilha genérica (qualquer XLSX/CSV que o cliente jogue). Tudo puro e
// testável: recebe linhas (Record<string, unknown>) e devolve metadados de
// coluna + funções de agregação prontas pros gráficos (KPI, série temporal,
// group-by, crosstab). Sem dependência — roda no browser e no vitest.

export type ColumnType = 'number' | 'date' | 'category' | 'text';

export type ColumnProfile = {
  name: string;
  type: ColumnType;
  /** Nº de valores não-vazios. */
  count: number;
  /** Nº de valores distintos (cardinalidade). */
  distinct: number;
  /** % de linhas preenchidas (0–1). */
  fill: number;
  // Só para type === 'number':
  sum?: number;
  mean?: number;
  min?: number;
  max?: number;
  // Só para type === 'date':
  minDate?: string;
  maxDate?: string;
};

export type Dataset = {
  rows: Row[];
  columns: ColumnProfile[];
};

export type Row = Record<string, CellValue>;
export type CellValue = string | number | boolean | null;

// ─── Coerção de valores ───────────────────────────────────────────────────

const allThousands = (groups: string[]): boolean =>
  groups.length > 1 && groups[0]!.length >= 1 && groups.slice(1).every((g) => g.length === 3);

/**
 * Converte "R$ 1.234,56", "1,234.56", "$2,000", "12,5%", 42 → number, ou null.
 * Resolve a ambiguidade vírgula/ponto pelo separador que aparece por último
 * (= decimal); quando só há um separador, decide milhar vs decimal pelo
 * agrupamento de 3 dígitos.
 */
export function coerceNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const raw = String(v).trim();
  if (!raw) return null;
  const isPercent = raw.includes('%');
  const s = raw.replace(/\s|R\$|US\$|\$|€|%/g, '');
  if (!/^-?[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma !== -1 && lastDot !== -1) {
    // ambos presentes: o último é o decimal.
    normalized = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    normalized = allThousands(s.split(',')) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot !== -1) {
    normalized = allThousands(s.split('.')) ? s.replace(/\./g, '') : s;
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return isPercent ? n / 100 : n;
}

const BR_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/;

/** Converte string/Date → ISO "YYYY-MM-DD", ou null. */
export function coerceDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return toISO(v);
  const raw = String(v).trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(raw);
  if (iso) {
    // Constrói em horário local (não UTC) pra casar com os getters de toISO —
    // senão "2026-03-01" vira "2026-02" em fusos negativos (Brasil UTC-3).
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, iso[3] ? Number(iso[3]) : 1);
    return isNaN(d.getTime()) ? null : toISO(d);
  }
  const m = BR_DATE.exec(raw);
  if (m) {
    const dd = m[1]!, mm = m[2]!, yy = m[3]!;
    const year = yy.length === 2 ? `20${yy}` : yy;
    const d = new Date(Number(year), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : toISO(d);
  }
  return null;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Perfilagem de colunas ──────────────────────────────────────────────────

/**
 * Detecta o tipo de cada coluna por amostragem: se ≥80% dos valores
 * preenchidos são numéricos → number; se ≥70% são datas → date; senão
 * category (baixa cardinalidade) ou text (alta).
 */
export function profileColumns(rows: Row[]): ColumnProfile[] {
  if (rows.length === 0) return [];
  const names = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );

  return names.map((name) => {
    const values = rows.map((r) => r[name]).filter((v) => v != null && v !== '');
    const count = values.length;
    const fill = rows.length ? count / rows.length : 0;
    const distinct = new Set(values.map((v) => String(v))).size;

    if (count === 0) {
      return { name, type: 'text' as const, count, distinct, fill };
    }

    const nums = values.map(coerceNumber).filter((n): n is number => n != null);
    if (nums.length / count >= 0.8) {
      const sum = nums.reduce((a, b) => a + b, 0);
      return {
        name,
        type: 'number' as const,
        count,
        distinct,
        fill,
        sum,
        mean: sum / nums.length,
        min: Math.min(...nums),
        max: Math.max(...nums),
      };
    }

    const dates = values.map(coerceDate).filter((d): d is string => d != null);
    if (dates.length / count >= 0.7) {
      const sorted = [...dates].sort();
      return {
        name,
        type: 'date' as const,
        count,
        distinct,
        fill,
        minDate: sorted[0],
        maxDate: sorted[sorted.length - 1],
      };
    }

    // Baixa cardinalidade relativa → dimensão categórica; alta → texto livre.
    const type: ColumnType = distinct <= Math.max(50, count * 0.5) ? 'category' : 'text';
    return { name, type, count, distinct, fill };
  });
}

export function buildDataset(rows: Row[]): Dataset {
  return { rows, columns: profileColumns(rows) };
}

// ─── Seleção automática de defaults ─────────────────────────────────────────

export type DashboardPlan = {
  measures: string[];
  primaryMeasure: string | null;
  dimensions: string[];
  primaryDimension: string | null;
  secondaryDimension: string | null;
  dateColumn: string | null;
};

/**
 * Escolhe medidas/dimensões/data "boas" pros gráficos. Medida primária = a
 * numérica de maior soma (tipicamente valor/gasto). Dimensão primária = a
 * categórica com cardinalidade útil (2..40). Data = a coluna de data mais
 * preenchida.
 */
export function planDashboard(columns: ColumnProfile[]): DashboardPlan {
  const measures = columns
    .filter((c) => c.type === 'number')
    .sort((a, b) => Math.abs(b.sum ?? 0) - Math.abs(a.sum ?? 0))
    .map((c) => c.name);

  const dims = columns
    .filter((c) => c.type === 'category' && c.distinct >= 2)
    .sort((a, b) => usefulness(b) - usefulness(a))
    .map((c) => c.name);

  const dateCol =
    columns
      .filter((c) => c.type === 'date')
      .sort((a, b) => b.fill - a.fill)[0]?.name ?? null;

  return {
    measures,
    primaryMeasure: measures[0] ?? null,
    dimensions: dims,
    primaryDimension: dims[0] ?? null,
    secondaryDimension: dims[1] ?? null,
    dateColumn: dateCol,
  };
}

// Cardinalidade "ideal" pra um gráfico de barras/rosca: penaliza 1 valor ou
// dezenas de valores; premia 3..15 categorias distintas.
function usefulness(c: ColumnProfile): number {
  const d = c.distinct;
  if (d < 2) return -1;
  const ideal = 8;
  return 100 - Math.abs(d - ideal) - Math.max(0, d - 40) * 2;
}

// ─── Agregações ─────────────────────────────────────────────────────────────

export type Agg = 'sum' | 'mean' | 'count' | 'min' | 'max';

export type GroupSlice = { key: string; value: number; count: number };

/** Agrupa por uma dimensão e agrega uma medida (ou conta linhas). */
export function groupBy(
  rows: Row[],
  dim: string,
  measure: string | null,
  agg: Agg = 'sum',
): GroupSlice[] {
  const buckets = new Map<string, { total: number; count: number; min: number; max: number }>();
  for (const r of rows) {
    const key = keyOf(r[dim]);
    const b = buckets.get(key) ?? { total: 0, count: 0, min: Infinity, max: -Infinity };
    b.count += 1;
    if (measure) {
      const n = coerceNumber(r[measure]);
      if (n != null) {
        b.total += n;
        b.min = Math.min(b.min, n);
        b.max = Math.max(b.max, n);
      }
    }
    buckets.set(key, b);
  }
  const out: GroupSlice[] = [];
  for (const [key, b] of buckets) {
    let value: number;
    switch (agg) {
      case 'count': value = b.count; break;
      case 'mean': value = b.count ? b.total / b.count : 0; break;
      case 'min': value = b.min === Infinity ? 0 : b.min; break;
      case 'max': value = b.max === -Infinity ? 0 : b.max; break;
      default: value = b.total;
    }
    out.push({ key, value, count: b.count });
  }
  return out.sort((a, b) => b.value - a.value);
}

/** Top-N fatias; agrupa o resto em "Outros". */
export function topN(slices: GroupSlice[], n: number, othersLabel = 'Outros'): GroupSlice[] {
  if (slices.length <= n) return slices;
  const head = slices.slice(0, n);
  const tail = slices.slice(n);
  const rest = tail.reduce(
    (acc, s) => ({ value: acc.value + s.value, count: acc.count + s.count }),
    { value: 0, count: 0 },
  );
  return [...head, { key: othersLabel, value: rest.value, count: rest.count }];
}

export type TimePoint = { key: string; value: number; count: number };

/** Série temporal agregada por mês (YYYY-MM). */
export function timeSeries(
  rows: Row[],
  dateCol: string,
  measure: string | null,
  agg: Agg = 'sum',
): TimePoint[] {
  const buckets = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const iso = coerceDate(r[dateCol]);
    if (!iso) continue;
    const month = iso.slice(0, 7);
    const b = buckets.get(month) ?? { total: 0, count: 0 };
    b.count += 1;
    if (measure) {
      const n = coerceNumber(r[measure]);
      if (n != null) b.total += n;
    }
    buckets.set(month, b);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => ({
      key,
      value: agg === 'count' ? b.count : agg === 'mean' ? (b.count ? b.total / b.count : 0) : b.total,
      count: b.count,
    }));
}

export type CrosstabResult = {
  rowKeys: string[];
  colKeys: string[];
  /** matrix[rowKey][colKey] = valor agregado. */
  matrix: Record<string, Record<string, number>>;
  /** Formato "long" pronto pro recharts stacked bar: [{ dim, [colKey]: n }]. */
  stacked: Array<Record<string, string | number>>;
};

/** Tabela cruzada dimA × dimB agregando measure — base de stacked bar e heatmap. */
export function crosstab(
  rows: Row[],
  dimA: string,
  dimB: string,
  measure: string | null,
  opts: { topRows?: number; topCols?: number } = {},
): CrosstabResult {
  const { topRows = 8, topCols = 6 } = opts;
  const rowTotals = topN(groupBy(rows, dimA, measure), topRows).map((s) => s.key);
  const colTotals = topN(groupBy(rows, dimB, measure), topCols).map((s) => s.key);
  const rowSet = new Set(rowTotals);
  const colSet = new Set(colTotals);

  const matrix: Record<string, Record<string, number>> = {};
  for (const rk of rowTotals) {
    const row: Record<string, number> = {};
    for (const ck of colTotals) row[ck] = 0;
    matrix[rk] = row;
  }

  for (const r of rows) {
    let rk = keyOf(r[dimA]);
    let ck = keyOf(r[dimB]);
    if (!rowSet.has(rk)) rk = rowTotals.includes('Outros') ? 'Outros' : rk;
    if (!colSet.has(ck)) ck = colTotals.includes('Outros') ? 'Outros' : ck;
    const row = matrix[rk];
    if (!row || !(ck in row)) continue;
    const n = measure ? coerceNumber(r[measure]) : 1;
    row[ck] = (row[ck] ?? 0) + (n ?? 0);
  }

  const stacked = rowTotals.map((rk) => {
    const entry: Record<string, string | number> = { dim: rk };
    const row = matrix[rk] ?? {};
    for (const ck of colTotals) entry[ck] = row[ck] ?? 0;
    return entry;
  });

  return { rowKeys: rowTotals, colKeys: colTotals, matrix, stacked };
}

/** Correlação de Pearson entre duas medidas (para scatter/insight). */
export function scatterPairs(
  rows: Row[],
  xCol: string,
  yCol: string,
  labelCol: string | null,
): Array<{ x: number; y: number; label: string }> {
  const out: Array<{ x: number; y: number; label: string }> = [];
  for (const r of rows) {
    const x = coerceNumber(r[xCol]);
    const y = coerceNumber(r[yCol]);
    if (x == null || y == null) continue;
    out.push({ x, y, label: labelCol ? keyOf(r[labelCol]) : '' });
  }
  return out;
}

// ─── KPIs ────────────────────────────────────────────────────────────────

export type Kpi = { label: string; value: number; format: 'number' | 'currency' | 'percent'; hint?: string };

/**
 * KPIs automáticos: total de registros + sum/média/máx da medida primária +
 * distintos da dimensão primária. Heurística de moeda pelo nome da coluna.
 */
export function autoKpis(dataset: Dataset, plan: DashboardPlan): Kpi[] {
  const { rows, columns } = dataset;
  const kpis: Kpi[] = [{ label: 'Registros', value: rows.length, format: 'number' }];

  const pm = plan.primaryMeasure;
  if (pm) {
    const col = columns.find((c) => c.name === pm);
    const fmt = looksLikeMoney(pm) ? 'currency' : looksLikePercent(pm) ? 'percent' : 'number';
    if (col?.sum != null) kpis.push({ label: `Total · ${pm}`, value: col.sum, format: fmt });
    if (col?.mean != null) kpis.push({ label: `Média · ${pm}`, value: col.mean, format: fmt });
    if (col?.max != null) kpis.push({ label: `Máx · ${pm}`, value: col.max, format: fmt });
  }

  const pd = plan.primaryDimension;
  if (pd) {
    const col = columns.find((c) => c.name === pd);
    if (col) kpis.push({ label: `${pd} distintos`, value: col.distinct, format: 'number' });
  }

  // Segunda medida como KPI extra, se houver.
  const m2 = plan.measures[1];
  if (m2) {
    const col = columns.find((c) => c.name === m2);
    const fmt = looksLikeMoney(m2) ? 'currency' : looksLikePercent(m2) ? 'percent' : 'number';
    if (col?.sum != null) kpis.push({ label: `Total · ${m2}`, value: col.sum, format: fmt });
  }

  return kpis.slice(0, 6);
}

export function looksLikeMoney(name: string): boolean {
  return /valor|total|gasto|custo|pre[çc]o|receita|faturamento|spend|amount|cost|price|revenue|r\$|savings|economia/i.test(
    name,
  );
}
export function looksLikePercent(name: string): boolean {
  return /%|percent|taxa|margem|share|pct/i.test(name);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const EMPTY_KEY = '(vazio)';
export function keyOf(v: unknown): string {
  if (v == null || v === '') return EMPTY_KEY;
  return String(v).trim() || EMPTY_KEY;
}
