import type { Row, CellValue } from './analyze';

// Parsing client-side de planilha → Row[]. CSV é parseado puro (testável);
// XLSX via exceljs carregado sob demanda (dynamic import) pra não pesar o
// bundle das outras rotas. Primeira linha não-vazia = cabeçalho.

export type ParsedFile = { name: string; rows: Row[]; sheetName?: string };

export const MAX_ROWS = 20000;

/** Detecta separador (vírgula, ponto-e-vírgula ou tab) pela 1ª linha. */
function detectDelimiter(headerLine: string): string {
  const counts: Record<string, number> = {
    ',': (headerLine.match(/,/g) || []).length,
    ';': (headerLine.match(/;/g) || []).length,
    '\t': (headerLine.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0];
}

/** Parser CSV tolerante a aspas e quebras de linha dentro de campos. */
export function parseCsv(text: string): Row[] {
  const clean = text.replace(/^﻿/, ''); // strip BOM
  const firstLine = clean.slice(0, clean.indexOf('\n') === -1 ? undefined : clean.indexOf('\n'));
  const delim = detectDelimiter(firstLine);

  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      record.push(field); field = '';
    } else if (ch === '\n') {
      record.push(field); field = '';
      if (record.some((c) => c.trim() !== '')) records.push(record);
      record = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || record.length) {
    record.push(field);
    if (record.some((c) => c.trim() !== '')) records.push(record);
  }

  return recordsToRows(records);
}

/** Converte matriz [header, ...rows] → Row[] com nomes de coluna únicos. */
export function recordsToRows(records: Array<Array<CellValue>>): Row[] {
  if (records.length < 1) return [];
  const headerRaw = records[0]!.map((h) => (h == null ? '' : String(h).trim()));
  const seen = new Map<string, number>();
  const headers = headerRaw.map((h, i) => {
    const base = h || `Coluna ${i + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base} (${n + 1})`;
  });

  const rows: Row[] = [];
  for (let r = 1; r < records.length && rows.length < MAX_ROWS; r++) {
    const rec = records[r]!;
    const row: Row = {};
    headers.forEach((h, i) => {
      const v = rec[i];
      row[h] = v == null || v === '' ? null : (v as CellValue);
    });
    rows.push(row);
  }
  return rows;
}

/** Lê um File do input → ParsedFile. XLSX via exceljs, CSV/TSV texto. */
export async function parseSpreadsheetFile(file: File): Promise<ParsedFile> {
  const name = file.name;
  const isCsv = /\.(csv|tsv|txt)$/i.test(name);
  if (isCsv) {
    const text = await file.text();
    return { name, rows: parseCsv(text) };
  }

  // XLSX / XLSM
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets.find((w) => w.rowCount > 1) ?? wb.worksheets[0];
  if (!ws) return { name, rows: [] };

  const records: Array<Array<CellValue>> = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const rec: CellValue[] = [];
    // eachCell pula células vazias; usamos o índice pra manter alinhamento.
    const values = row.values as unknown[]; // [<empty>, col1, col2, ...]
    for (let c = 1; c < values.length; c++) {
      rec[c - 1] = normalizeCell(values[c]);
    }
    records.push(rec);
  });

  return { name, rows: recordsToRows(records), sheetName: ws.name };
}

function normalizeCell(v: unknown): CellValue {
  if (v == null) return null;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Célula rica do exceljs: { text }, { result }, { hyperlink } etc.
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('text' in o) return String(o.text);
    if ('result' in o) return normalizeCell(o.result);
    if ('richText' in o && Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>).map((t) => t.text ?? '').join('');
    }
  }
  return String(v);
}

// ─── Formatação de valores pra UI ───────────────────────────────────────────

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const num0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function fmtCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `R$ ${num1.format(n / 1_000_000)}M`;
  if (Math.abs(n) >= 10_000) return `R$ ${num1.format(n / 1000)}k`;
  return brl.format(n);
}
export function fmtNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${num1.format(n / 1_000_000)}M`;
  if (Math.abs(n) >= 10_000) return `${num1.format(n / 1000)}k`;
  return num0.format(n);
}
export function fmtPercent(n: number): string {
  // aceita 0.23 (fração) ou 23 (já em %)
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${num1.format(pct)}%`;
}
export function fmtBy(format: 'number' | 'currency' | 'percent', n: number): string {
  return format === 'currency' ? fmtCurrency(n) : format === 'percent' ? fmtPercent(n) : fmtNumber(n);
}
