import ExcelJS from 'exceljs';
import { z } from 'zod';
import { AbcItemSchema, type AbcItem } from './types';

// Sub-projeto 31 — Import de planilha de spend → AbcItem[].
//
// Suporta dois layouts:
//   1. Template Procurement Garage (aba "Relação de Pedidos") com colunas
//      fixas: Fornecedor | Doc.compra | Texto breve Material | Qtd.pedido
//      | Unid. | Moeda | Preço líq. | %  | % Acumulado
//   2. Genérico por nome de header (fuzzy match em nome/material/sku +
//      spend/valor/preço + supplier opcional + qty/quantidade opcional)
//
// Coerções:
//   - números em pt-BR ("1.234,56") → 1234.56
//   - strings em maiúsculas/minúsculas normalizadas pra fuzzy match
//
// Output: { items, warnings } — items são AbcItem zod-validados.

export type ImportResult = {
  items: AbcItem[];
  warnings: string[];
};

const HEADER_ALIASES: Record<keyof AbcItem, RegExp[]> = {
  name: [
    /\bmaterial\b/i,
    /\btexto.*material\b/i,
    /\bproduto\b/i,
    /\bdescri[çc][ãa]o\b/i,
    /\bitem\b/i,
    /\bsku\b/i,
    /\bnome\b/i,
  ],
  supplier: [/\bfornecedor\b/i, /\bsupplier\b/i, /\bvendor\b/i],
  category: [/\bcategoria\b/i, /\bcategory\b/i, /\bclasse\b/i, /\bfamilia\b/i],
  quantity: [/\bqtd/i, /\bquantidade\b/i, /\bquantity\b/i, /\bqty\b/i],
  unit: [/\bunid\.?/i, /\bunit\b/i, /\bunidade\b/i, /\bUM\b/i],
  spend: [
    /\bspend\b/i,
    /\bvalor\b/i,
    /\bpre[çc]o.*l[íi]q/i,
    /\btotal\b/i,
    /\bgasto\b/i,
    /\bR\$/i,
  ],
};

function matchHeader(text: string): keyof AbcItem | null {
  const t = text.trim();
  for (const [field, patterns] of Object.entries(HEADER_ALIASES) as Array<
    [keyof AbcItem, RegExp[]]
  >) {
    if (patterns.some((p) => p.test(t))) return field;
  }
  return null;
}

function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (!s) return null;
  // pt-BR: "1.234,56" → 1234.56. Strip thousands dots, replace comma with dot.
  const cleaned = s.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function coerceString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const obj = value as { text?: unknown; result?: unknown };
    if (typeof obj.text === 'string') return obj.text.trim();
    if (obj.result !== undefined && obj.result !== null)
      return String(obj.result).trim();
    return '';
  }
  return String(value).trim();
}

/** PG layout detection — header row has "Fornecedor" in col A and
 *  "Preço líq." somewhere in the first row. */
function looksLikePgLayout(ws: ExcelJS.Worksheet): boolean {
  const headerRow = ws.getRow(1);
  let hasFornecedor = false;
  let hasPrecoLiq = false;
  headerRow.eachCell((cell) => {
    const txt = coerceString(cell.value).toLowerCase();
    if (/fornecedor/.test(txt)) hasFornecedor = true;
    if (/pre[çc]o.*l[íi]q/.test(txt)) hasPrecoLiq = true;
  });
  return hasFornecedor && hasPrecoLiq;
}

/** Generic header-based parser (works for the PG layout too). */
function parseByHeader(ws: ExcelJS.Worksheet): ImportResult {
  const items: AbcItem[] = [];
  const warnings: string[] = [];

  const headerRow = ws.getRow(1);
  const colMap: Partial<Record<keyof AbcItem, number>> = {};
  headerRow.eachCell((cell, colNumber) => {
    const txt = coerceString(cell.value);
    const k = matchHeader(txt);
    if (k && !(k in colMap)) colMap[k] = colNumber;
  });

  // name and spend are mandatory for ABC; others are optional.
  if (colMap.name === undefined || colMap.spend === undefined) {
    warnings.push(
      `Colunas obrigatórias não detectadas: ${
        colMap.name === undefined ? 'nome do material/produto' : ''
      }${colMap.name === undefined && colMap.spend === undefined ? ' + ' : ''}${
        colMap.spend === undefined ? 'spend/valor/preço' : ''
      }`,
    );
    return { items, warnings };
  }

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = coerceString(row.getCell(colMap.name).value);
    if (!name) continue;
    const spendValue = coerceNumber(row.getCell(colMap.spend).value);
    if (spendValue === null) continue;

    const candidate = {
      name,
      supplier: colMap.supplier
        ? coerceString(row.getCell(colMap.supplier).value)
        : '',
      category: colMap.category
        ? coerceString(row.getCell(colMap.category).value)
        : '',
      quantity:
        colMap.quantity !== undefined
          ? (coerceNumber(row.getCell(colMap.quantity).value) ?? undefined)
          : undefined,
      unit: colMap.unit ? coerceString(row.getCell(colMap.unit).value) : '',
      spend: spendValue,
    };
    const parsed = AbcItemSchema.safeParse(candidate);
    if (parsed.success) {
      items.push(parsed.data);
    } else {
      warnings.push(
        `Linha ${r} (${name.slice(0, 40)}): ${parsed.error.issues[0]?.message ?? 'inválido'}`,
      );
    }
  }
  return { items, warnings };
}

/** Parse XLSX from a Buffer. */
export async function parseAbcXlsx(buffer: Buffer): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  // Prefer the PG sheet name if present; else first sheet.
  const candidate =
    wb.getWorksheet('Relação de Pedidos') ??
    wb.getWorksheet('Relacao de Pedidos') ??
    wb.worksheets[0];
  if (!candidate) {
    return { items: [], warnings: ['Workbook sem planilhas'] };
  }
  void looksLikePgLayout; // reserved for future PG-specific tweaks
  return parseByHeader(candidate);
}

/** Parse CSV (with header row) — comma or semicolon separated. */
export function parseAbcCsv(csv: string): ImportResult {
  const lines = csv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { items: [], warnings: ['CSV vazio ou sem linhas de dados'] };
  }
  // Auto-detect delimiter: prefer ; if first line contains it.
  const sep = lines[0]!.includes(';') ? ';' : ',';
  const headers = lines[0]!.split(sep).map((h) => h.trim().replace(/^"|"$/g, ''));
  const colMap: Partial<Record<keyof AbcItem, number>> = {};
  headers.forEach((h, i) => {
    const k = matchHeader(h);
    if (k && !(k in colMap)) colMap[k] = i;
  });

  const warnings: string[] = [];
  if (colMap.name === undefined || colMap.spend === undefined) {
    warnings.push(
      'CSV precisa de colunas para nome/material e spend/valor (cabeçalho na 1ª linha).',
    );
    return { items: [], warnings };
  }

  const items: AbcItem[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]!, sep);
    const name = (cells[colMap.name] ?? '').trim();
    if (!name) continue;
    const spendStr = cells[colMap.spend] ?? '';
    const spendValue = coerceNumber(spendStr);
    if (spendValue === null) continue;
    const candidate = {
      name,
      supplier: colMap.supplier !== undefined ? (cells[colMap.supplier] ?? '').trim() : '',
      category: colMap.category !== undefined ? (cells[colMap.category] ?? '').trim() : '',
      quantity:
        colMap.quantity !== undefined
          ? (coerceNumber(cells[colMap.quantity] ?? '') ?? undefined)
          : undefined,
      unit: colMap.unit !== undefined ? (cells[colMap.unit] ?? '').trim() : '',
      spend: spendValue,
    };
    const parsed = AbcItemSchema.safeParse(candidate);
    if (parsed.success) items.push(parsed.data);
    else
      warnings.push(
        `Linha ${r + 1}: ${parsed.error.issues[0]?.message ?? 'inválido'}`,
      );
  }
  return { items, warnings };
}

/** Tiny CSV splitter — handles quoted fields containing the separator. */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/^"|"$/g, ''));
}

/** Coerces an AbcItem[] from anything — used by the import endpoint to
 *  dispatch by mime/extension. */
export async function parseAbcImport(input: {
  buf: Buffer;
  mime: string;
  filename: string;
}): Promise<ImportResult> {
  const lower = input.filename.toLowerCase();
  if (
    input.mime === 'text/csv' ||
    lower.endsWith('.csv') ||
    input.mime === 'text/plain'
  ) {
    return parseAbcCsv(input.buf.toString('utf-8'));
  }
  return parseAbcXlsx(input.buf);
}

// Re-export Zod-friendly version for tests.
export const _testing = { matchHeader, coerceNumber, splitCsvLine };
// keep z-import used (linter quiet — exported schema lives in types.ts)
void z;
