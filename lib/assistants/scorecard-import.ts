import ExcelJS from 'exceljs';
import type { ScorecardCriterion, ScorecardSupplier } from './types';

// Sub-projeto (Scorecard) — Parse an uploaded .xlsx into scorecard data.
//
// Spreadsheet shape:
//   Row 1 = headers: col 1 = supplier-name column (header text ignored),
//           cols 2..n = criterion labels.
//   Row 2+ = data rows: col 1 = supplier name (skip if blank),
//            cols 2..n = numeric 0–10 scores.
//
// Uses 'Scorecard' worksheet if present; falls back to first sheet.

export type ScorecardImportResult = {
  criteria: ScorecardCriterion[];
  suppliers: ScorecardSupplier[];
  warnings: string[];
};

// ── helpers (mirrors kraljic-import.ts) ──────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** pt-BR aware number coercion. Treats "5,5" as 5.5.
 *  Falls back to `fallback` when the value cannot be parsed. */
function coerceNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (v === null || v === undefined) return fallback;
  // Rich ExcelJS cell objects (formula results, etc.) may carry .result
  if (typeof v === 'object') {
    const obj = v as { result?: unknown; text?: unknown };
    if (typeof obj.result === 'number') return Number.isFinite(obj.result) ? obj.result : fallback;
    if (obj.text !== undefined) return coerceNumber(obj.text, fallback);
    return fallback;
  }
  const s = String(v)
    .trim()
    .replace(/[^0-9.,-]/g, '')
    .replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

/** Convert a criterion label into a URL-safe slug ID. */
function slug(label: string): string {
  return normalize(label)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Clamp value to [0, 10]. */
function clamp(v: number): number {
  return Math.min(10, Math.max(0, v));
}

// ── main export ───────────────────────────────────────────────────────────

export async function parseScorecardXlsx(
  buffer: Buffer,
): Promise<ScorecardImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const ws = wb.getWorksheet('Scorecard') ?? wb.worksheets[0];
  if (!ws) {
    return { criteria: [], suppliers: [], warnings: ['Workbook sem planilhas'] };
  }

  const warnings: string[] = [];

  // ── Row 1: header row ────────────────────────────────────────────────────
  const headerRow = ws.getRow(1);

  // Fix 2: actualColumnCount is more reliable for buffer-loaded sheets —
  // avoids phantom styled columns (overcount) and undercount from sparse sheets.
  const lastCol = ws.actualColumnCount || ws.columnCount || 1;

  // Build criteria from cols 2..lastCol
  const criteria: ScorecardCriterion[] = [];
  for (let col = 2; col <= lastCol; col++) {
    const raw = String(headerRow.getCell(col).value ?? '').trim();
    const id = raw ? slug(raw) || `criterio-${col - 1}` : `criterio-${col - 1}`;
    criteria.push({ id, label: raw || `Critério ${col - 1}`, weight: 0 });
  }

  if (criteria.length === 0) {
    warnings.push('Nenhum critério encontrado (planilha tem apenas 1 coluna)');
    return { criteria: [], suppliers: [], warnings };
  }

  // Fix 1: De-duplicate slugged ids — two labels that slug to the same string
  // (e.g. "Preço" and "Preco") would otherwise cause silent score overwrites and
  // double-counted weights. Suffix collisions with -2, -3, … before reading data.
  const seen = new Map<string, number>();
  for (const c of criteria) {
    const n = (seen.get(c.id) ?? 0) + 1;
    seen.set(c.id, n);
    if (n > 1) {
      const newId = `${c.id}-${n}`;
      warnings.push(
        `Critérios com nomes que geram o mesmo identificador — "${c.label}" renomeado para id "${newId}".`,
      );
      c.id = newId;
    }
  }

  // ── Equal-weight distribution; last criterion absorbs remainder ──────────
  const n = criteria.length;
  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  for (let i = 0; i < n; i++) {
    criteria[i]!.weight = i === n - 1 ? base + remainder : base;
  }

  // ── Data rows ────────────────────────────────────────────────────────────
  const suppliers: ScorecardSupplier[] = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = String(row.getCell(1).value ?? '').trim();
    if (!name) continue; // skip blank rows

    const scores: Record<string, number> = {};
    for (let i = 0; i < criteria.length; i++) {
      const col = i + 2;
      const criterion = criteria[i]!;
      // Células não-numéricas ou vazias viram 0 = "não avaliado".
      const raw = coerceNumber(row.getCell(col).value, 0);
      const clamped = clamp(raw);
      if (raw < 0 || raw > 10) {
        warnings.push(
          `Fornecedor "${name}", critério "${criterion.label}": valor ajustado para 0–10`,
        );
      }
      scores[criterion.id] = clamped;
    }

    // `segment` é definido pelo scorecard de avaliação, não vem da planilha.
    suppliers.push({ name, segment: '', scores });
  }

  if (suppliers.length === 0) {
    warnings.push('Nenhum fornecedor encontrado (sem linhas de dados)');
    // Fix 3: return the parsed criteria so the UI can display detected columns
    // even when there are no data rows (the no-CRITERIA guard above still returns []).
    return { criteria, suppliers: [], warnings };
  }

  return { criteria, suppliers, warnings };
}
