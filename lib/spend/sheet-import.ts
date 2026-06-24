import ExcelJS from 'exceljs';
import type { SpendInvoiceFields } from './types';

// Spend Analysis (fase 1) — import de planilha (XLSX/CSV) → SpendInvoiceFields[].
// Espelha `lib/assistants/abc-import.ts` (fuzzy headers + coerção numérica),
// mas captura todos os campos da invoice. `total` é o único obrigatório por
// linha; o resto é opcional. A categoria vem como texto livre (o pipeline
// re-classifica as linhas sem categoria).

export type SpendImportResult = {
  rows: SpendInvoiceFields[];
  warnings: string[];
};

type Field = keyof Pick<
  SpendInvoiceFields,
  | 'invoiceNumber'
  | 'poNumber'
  | 'supplier'
  | 'category'
  | 'country'
  | 'currency'
  | 'paymentTerms'
  | 'invoiceDate'
  | 'description'
  | 'total'
>;

// Ordem importa: campos mais específicos antes; `total` por último para que
// "valor total" caia em total e "descrição" em description.
const HEADER_ALIASES: Array<[Field, RegExp[]]> = [
  ['invoiceNumber', [/invoice\s*(no|n[ºo°]|number)/i, /\bfatura\b/i, /\bnf\b/i, /n[ºo°]\s*(da)?\s*nota/i, /\bnota fiscal\b/i]],
  ['poNumber', [/\bpo\b/i, /purchase\s*order/i, /\bpedido\b/i, /ordem\s*de\s*compra/i]],
  ['supplier', [/\bfornecedor\b/i, /\bsupplier\b/i, /\bvendor\b/i, /\bemitente\b/i]],
  ['category', [/\bcategoria\b/i, /\bcategory\b/i, /\bclasse\b/i, /\bfamilia\b/i]],
  ['country', [/\bpa[íi]s\b/i, /\bcountry\b/i]],
  ['currency', [/\bmoeda\b/i, /\bcurrency\b/i, /\bccy\b/i]],
  ['paymentTerms', [/payment.*term/i, /condi[çc][ãa]o.*pag/i, /\bterms\b/i, /\bvencimento\b/i, /\bprazo\b/i]],
  ['invoiceDate', [/\bdata\b/i, /\bdate\b/i, /emiss[ãa]o/i]],
  ['description', [/descri[çc][ãa]o/i, /description/i, /\bitem\b/i, /servi[çc]o/i, /\bmaterial\b/i]],
  ['total', [/\btotal\b/i, /\bvalor\b/i, /\bamount\b/i, /\bspend\b/i, /\bgasto\b/i, /\bR\$/i]],
];

export function matchHeader(text: string): Field | null {
  const t = text.trim();
  if (!t) return null;
  for (const [field, patterns] of HEADER_ALIASES) {
    if (patterns.some((p) => p.test(t))) return field;
  }
  return null;
}

/**
 * Coerção de valor monetário tolerante a pt-BR ("1.234,56") e en-US
 * ("1,234.56"). Regra: o ÚLTIMO separador (',' ou '.') é o decimal.
 */
export function coerceAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  if (!s) return null;
  // Parênteses = negativo contábil.
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  // Remove tudo exceto dígitos, vírgula, ponto e sinal de menos.
  s = s.replace(/[^\d.,-]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let cleaned: string;
  if (lastComma > lastDot) {
    // vírgula é o decimal → remove pontos (milhar), vírgula vira ponto.
    cleaned = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // ponto é o decimal → remove vírgulas (milhar).
    cleaned = s.replace(/,/g, '');
  } else {
    cleaned = s; // só dígitos / sinal
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? sign * n : null;
}

/** Converte data de vários formatos para YYYY-MM-DD (ou null). */
export function coerceDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  // ISO já pronto.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY ou MM/DD/YYYY (assume DD/MM salvo se o 1º > 12).
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (dmy) {
    const [, a, b, y] = dmy as unknown as [string, string, string, string];
    let dd = parseInt(a, 10);
    let mm = parseInt(b, 10);
    if (dd > 12 && mm <= 12) {
      // ok, DD/MM
    } else if (mm > 12 && dd <= 12) {
      [dd, mm] = [mm, dd]; // era MM/DD
    }
    let year = parseInt(y, 10);
    if (year < 100) year += 2000;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  return null;
}

function coerceString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const obj = value as { text?: unknown; result?: unknown };
    if (typeof obj.text === 'string') return obj.text.trim();
    if (obj.result !== undefined && obj.result !== null) return String(obj.result).trim();
    return '';
  }
  return String(value).trim();
}

function buildRow(get: (f: Field) => unknown, colMap: Partial<Record<Field, true>>): SpendInvoiceFields | null {
  const total = colMap.total ? coerceAmount(get('total')) : null;
  // Linha sem valor é inútil para spend.
  if (total === null) return null;
  const str = (f: Field): string | null => {
    if (!colMap[f]) return null;
    const v = coerceString(get(f));
    return v.length > 0 ? v : null;
  };
  return {
    invoiceNumber: str('invoiceNumber'),
    poNumber: str('poNumber'),
    country: str('country'),
    currency: str('currency')?.toUpperCase() ?? null,
    total,
    paymentTerms: str('paymentTerms'),
    description: str('description'),
    supplier: str('supplier'),
    invoiceDate: colMap.invoiceDate ? coerceDate(get('invoiceDate')) : null,
    category: str('category'),
    categoryJustification: null,
    lowConfidence: false,
    ocrUsed: false,
  };
}

function parseWorksheet(ws: ExcelJS.Worksheet): SpendImportResult {
  const rows: SpendInvoiceFields[] = [];
  const warnings: string[] = [];

  const headerRow = ws.getRow(1);
  const colMap: Partial<Record<Field, number>> = {};
  headerRow.eachCell((cell, colNumber) => {
    const k = matchHeader(coerceString(cell.value));
    if (k && !(k in colMap)) colMap[k] = colNumber;
  });

  if (colMap.total === undefined) {
    warnings.push('Coluna obrigatória não detectada: total / valor da nota.');
    return { rows, warnings };
  }
  const present: Partial<Record<Field, true>> = {};
  for (const k of Object.keys(colMap) as Field[]) present[k] = true;

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const built = buildRow((f) => row.getCell(colMap[f]!).value, present);
    if (built) rows.push(built);
  }
  if (rows.length === 0) warnings.push('Nenhuma linha com valor numérico encontrada.');
  return { rows, warnings };
}

export async function parseSpendXlsx(buffer: Buffer): Promise<SpendImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], warnings: ['Workbook sem planilhas.'] };
  return parseWorksheet(ws);
}

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
      } else inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/^"|"$/g, ''));
}

export function parseSpendCsv(csv: string): SpendImportResult {
  const lines = csv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], warnings: ['CSV vazio ou sem linhas de dados.'] };
  const sep = lines[0]!.includes(';') ? ';' : ',';
  const headers = splitCsvLine(lines[0]!, sep);
  const colMap: Partial<Record<Field, number>> = {};
  headers.forEach((h, i) => {
    const k = matchHeader(h);
    if (k && !(k in colMap)) colMap[k] = i;
  });

  const warnings: string[] = [];
  if (colMap.total === undefined) {
    warnings.push('CSV precisa de uma coluna de total / valor (cabeçalho na 1ª linha).');
    return { rows: [], warnings };
  }
  const present: Partial<Record<Field, true>> = {};
  for (const k of Object.keys(colMap) as Field[]) present[k] = true;

  const rows: SpendInvoiceFields[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]!, sep);
    const built = buildRow((f) => cells[colMap[f]!] ?? '', present);
    if (built) rows.push(built);
  }
  if (rows.length === 0) warnings.push('Nenhuma linha com valor numérico encontrada.');
  return { rows, warnings };
}

/** Dispatcher por mime/extensão (usado pela rota de import). */
export async function parseSpendImport(input: {
  buf: Buffer;
  mime: string;
  filename: string;
}): Promise<SpendImportResult> {
  const lower = input.filename.toLowerCase();
  if (input.mime === 'text/csv' || lower.endsWith('.csv') || input.mime === 'text/plain') {
    return parseSpendCsv(input.buf.toString('utf-8'));
  }
  return parseSpendXlsx(input.buf);
}
