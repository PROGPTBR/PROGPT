import type { CubeInvoice, SpendBreakdown, SpendCube } from './types';

// Agregação determinística do spend (o "spend cube"). Pura, sem I/O — alimenta
// a narrativa LLM, os gráficos e o Excel. Notas sem câmbio resolvido
// (`totalRef == null`) NÃO entram nos totais de referência; são reportadas à
// parte em `semCambio` para não distorcer a comparação entre moedas.

const PO_NONE_RE = /^\s*(sem\s*po|n[ãa]o\s*informad\w*|sem\s*pedido|n\/?a|-)?\s*$/i;

/** True quando a nota tem um número de PO real (não vazio, não "Sem PO"). */
export function hasPurchaseOrder(poNumber: string | null | undefined): boolean {
  if (poNumber == null) return false;
  return !PO_NONE_RE.test(poNumber);
}

function rollup(
  rows: CubeInvoice[],
  keyOf: (r: CubeInvoice) => string,
  total: number,
): SpendBreakdown[] {
  const map = new Map<string, { totalRef: number; count: number }>();
  for (const r of rows) {
    const key = keyOf(r) || '(não informado)';
    const prev = map.get(key) ?? { totalRef: 0, count: 0 };
    prev.totalRef += r.totalRef ?? 0;
    prev.count += 1;
    map.set(key, prev);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      totalRef: v.totalRef,
      pct: total > 0 ? v.totalRef / total : 0,
      count: v.count,
    }))
    .sort((a, b) => b.totalRef - a.totalRef || a.key.localeCompare(b.key));
}

export function computeSpendCube(
  invoices: CubeInvoice[],
  referenceCurrency: string,
): SpendCube {
  // Notas sem câmbio resolvido ficam fora dos totais de referência.
  const inScope = invoices.filter((i) => i.totalRef != null);
  const semCambioRows = invoices.filter((i) => i.totalRef == null);

  const totalRef = inScope.reduce((acc, i) => acc + (i.totalRef ?? 0), 0);
  const invoiceCount = inScope.length;

  // ── Fornecedor: agrupa por normalizado, exibe o nome original mais comum ──
  const supplierDisplay = new Map<string, string>();
  for (const i of inScope) {
    const norm = i.supplierNormalized || i.supplier || '';
    if (!supplierDisplay.has(norm) && i.supplier) {
      supplierDisplay.set(norm, i.supplier);
    }
  }
  const bySupplier = rollup(
    inScope,
    (r) => {
      const norm = r.supplierNormalized || r.supplier || '';
      return supplierDisplay.get(norm) || norm;
    },
    totalRef,
  );

  const byCategory = rollup(inScope, (r) => r.category, totalRef);
  const byCountry = rollup(inScope, (r) => r.country, totalRef);

  // ── Por mês (YYYY-MM), só notas com data válida, ordem cronológica ────────
  const monthMap = new Map<string, { totalRef: number; count: number }>();
  for (const i of inScope) {
    if (!i.invoiceDate || i.invoiceDate.length < 7) continue;
    const key = i.invoiceDate.slice(0, 7);
    const prev = monthMap.get(key) ?? { totalRef: 0, count: 0 };
    prev.totalRef += i.totalRef ?? 0;
    prev.count += 1;
    monthMap.set(key, prev);
  }
  const byMonth = Array.from(monthMap.entries())
    .map(([key, v]) => ({ key, totalRef: v.totalRef, count: v.count }))
    .sort((a, b) => a.key.localeCompare(b.key));

  // ── Pareto de fornecedores (desc) + cumulativo (0-1) ──────────────────────
  let cum = 0;
  const pareto = bySupplier.map((s) => {
    cum += totalRef > 0 ? s.totalRef / totalRef : 0;
    return { key: s.key, totalRef: s.totalRef, cumPct: cum };
  });

  // ── Tail spend: fornecedores cujo cumulativo ANTES deles já passou de 80% ─
  let cumBefore = 0;
  let suppliersBeyond80Pct = 0;
  let tailSpendRef = 0;
  for (const s of bySupplier) {
    if (cumBefore >= 0.8) {
      suppliersBeyond80Pct += 1;
      tailSpendRef += s.totalRef;
    }
    cumBefore += totalRef > 0 ? s.totalRef / totalRef : 0;
  }

  // ── Cobertura de PO: sobre TODAS as notas; spend com PO sobre o ref ───────
  const allCount = invoices.length;
  const withPoCount = invoices.filter((i) => hasPurchaseOrder(i.poNumber)).length;
  const poCoveragePct = allCount > 0 ? withPoCount / allCount : 0;
  const poSpendRef = inScope
    .filter((i) => hasPurchaseOrder(i.poNumber))
    .reduce((acc, i) => acc + (i.totalRef ?? 0), 0);
  const poSpendPct = totalRef > 0 ? poSpendRef / totalRef : 0;

  // ── Moedas sem conversão ──────────────────────────────────────────────────
  const semMap = new Map<string, { total: number; count: number }>();
  for (const i of semCambioRows) {
    const key = i.currency || '(sem moeda)';
    const prev = semMap.get(key) ?? { total: 0, count: 0 };
    prev.total += i.total ?? 0;
    prev.count += 1;
    semMap.set(key, prev);
  }
  const semCambio = Array.from(semMap.entries())
    .map(([currency, v]) => ({ currency, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total || a.currency.localeCompare(b.currency));

  return {
    referenceCurrency,
    totalRef,
    invoiceCount,
    byCategory,
    bySupplier,
    byCountry,
    byMonth,
    pareto,
    poCoveragePct,
    poSpendPct,
    tailSpend: { suppliersBeyond80Pct, tailSpendRef },
    ticketMedio: invoiceCount > 0 ? totalRef / invoiceCount : 0,
    semCambio,
  };
}
