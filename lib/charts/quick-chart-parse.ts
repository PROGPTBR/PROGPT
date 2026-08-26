import ExcelJS from 'exceljs';
import type { QuickChartTable } from './types';

// "Gráfico Rápido" — parsing de dado LIVRE (texto colado no form ou planilha
// CSV/XLSX) numa tabela genérica headers+rows. Ao contrário de
// lib/spend/sheet-import.ts, NÃO faz fuzzy-match de campo fixo (invoiceNumber,
// total, etc.) — aceita qualquer par categoria/valor, decidido depois por
// quick-chart-infer.ts. Cabeçalho é sempre a primeira linha não-vazia.

export const QUICK_CHART_MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;
const MAX_COLS = 20;

export type QuickChartParseResult = { table: QuickChartTable; warnings: string[] };

function splitDelimited(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
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

function isMarkdownSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => c.trim() === '' || /^:?-{2,}:?$/.test(c.trim()));
}

function detectDelimiter(line: string): { sep: string; markdown: boolean } {
  const pipes = line.split('|').length - 1;
  if (pipes >= 2) return { sep: '|', markdown: true };
  if (line.includes('\t')) return { sep: '\t', markdown: false };
  if (line.includes(';')) return { sep: ';', markdown: false };
  if (line.includes(',')) return { sep: ',', markdown: false };
  return { sep: '', markdown: false }; // fallback: espaços múltiplos
}

function countDelim(line: string, sep: string): number {
  return sep === '|' ? line.split('|').length - 1 : line.split(sep).length - 1;
}

// Acha onde a tabela de verdade começa, ignorando eventual PROSA antes dela
// (ex.: "Monte um gráfico com esses dados:\nFornecedor\tGasto\n..." — comum
// quando o texto vem direto da mensagem do usuário no chat, não de um campo
// dedicado de colar tabela). Exige que a linha candidata e a linha seguinte
// tenham o MESMO número de células pro mesmo delimitador — filtra pontuação
// solta de prosa (uma vírgula numa frase não vira "header" por acidente).
function findTableStart(lines: string[]): { index: number; sep: string; markdown: boolean } | null {
  const candidates: Array<{ sep: string; markdown: boolean; minCount: number }> = [
    { sep: '\t', markdown: false, minCount: 1 },
    { sep: '|', markdown: true, minCount: 2 },
    { sep: ';', markdown: false, minCount: 1 },
    { sep: ',', markdown: false, minCount: 1 },
  ];
  for (const { sep, markdown, minCount } of candidates) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const count = countDelim(line, sep);
      if (count < minCount) continue;
      const cellsHere = markdown ? line.split('|').length : count + 1;
      if (i + 1 >= lines.length) return { index: i, sep, markdown };
      const next = lines[i + 1]!;
      const nextCount = countDelim(next, sep);
      const nextCells = markdown ? next.split('|').length : nextCount + 1;
      if (nextCount >= minCount && nextCells === cellsHere) return { index: i, sep, markdown };
    }
  }
  return null;
}

export function parsePastedTable(text: string): QuickChartParseResult {
  const warnings: string[] = [];
  const allLines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (allLines.length < 2) {
    return {
      table: { headers: [], rows: [] },
      warnings: ['Cole ao menos uma linha de cabeçalho e uma linha de dado.'],
    };
  }

  const found = findTableStart(allLines);
  const lines = found ? allLines.slice(found.index) : allLines;
  const { sep, markdown } = found ?? detectDelimiter(lines[0]!);

  if (lines.length < 2) {
    return {
      table: { headers: [], rows: [] },
      warnings: ['Cole ao menos uma linha de cabeçalho e uma linha de dado.'],
    };
  }

  const splitLine = (line: string): string[] => {
    if (!sep) return line.split(/\s{2,}/).map((c) => c.trim());
    let cells = splitDelimited(line, sep);
    if (markdown) {
      if (cells[0]?.trim() === '') cells = cells.slice(1);
      if (cells.length > 0 && cells[cells.length - 1]?.trim() === '') cells = cells.slice(0, -1);
    }
    return cells;
  };

  const headerCells = splitLine(lines[0]!).slice(0, MAX_COLS);
  const headers = headerCells.map((h, i) => h || `Coluna ${i + 1}`);
  if (headers.length < 2) {
    return {
      table: { headers, rows: [] },
      warnings: ['Preciso de pelo menos 2 colunas (uma de categoria e uma de valor).'],
    };
  }

  const rows: (string | number | null)[][] = [];
  for (let i = 1; i < lines.length && rows.length < MAX_ROWS; i++) {
    const cells = splitLine(lines[i]!);
    if (markdown && isMarkdownSeparatorRow(cells)) continue;
    rows.push(headers.map((_, c) => (cells[c] !== undefined && cells[c] !== '' ? cells[c]! : null)));
  }
  if (lines.length - 1 > MAX_ROWS) {
    warnings.push(`Mostrando as primeiras ${MAX_ROWS} linhas de ${lines.length - 1} coladas.`);
  }
  return { table: { headers, rows }, warnings };
}

function cellToValue(v: ExcelJS.CellValue): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const obj = v as { text?: unknown; result?: unknown };
    if (typeof obj.text === 'string') return obj.text.trim();
    if (obj.result !== undefined && obj.result !== null) {
      return typeof obj.result === 'number' ? obj.result : String(obj.result).trim();
    }
    return null;
  }
  return String(v).trim();
}

export async function parseQuickChartXlsx(buf: Buffer): Promise<QuickChartParseResult> {
  const warnings: string[] = [];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { table: { headers: [], rows: [] }, warnings: ['Workbook sem planilhas.'] };

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber > MAX_COLS) return;
    const v = cellToValue(cell.value);
    headers[colNumber - 1] = v === null ? `Coluna ${colNumber}` : String(v);
  });
  if (headers.length < 2) {
    return { table: { headers, rows: [] }, warnings: ['Preciso de pelo menos 2 colunas (categoria e valor).'] };
  }

  const cols = headers.length;
  const rows: (string | number | null)[][] = [];
  for (let r = 2; r <= ws.rowCount && rows.length < MAX_ROWS; r++) {
    const row = ws.getRow(r);
    const cells: (string | number | null)[] = [];
    for (let c = 1; c <= cols; c++) cells.push(cellToValue(row.getCell(c).value));
    if (cells.some((c) => c !== null && String(c).trim() !== '')) rows.push(cells);
  }
  if (ws.rowCount - 1 > MAX_ROWS) {
    warnings.push(`Mostrando as primeiras ${MAX_ROWS} linhas de ${ws.rowCount - 1}.`);
  }
  return { table: { headers, rows }, warnings };
}

/** Dispatcher: texto colado OU arquivo (CSV/XLSX) por mime/extensão. */
export async function parseQuickChartInput(input: {
  text?: string;
  buf?: Buffer;
  mime?: string;
  filename?: string;
}): Promise<QuickChartParseResult> {
  if (input.buf) {
    const lower = (input.filename ?? '').toLowerCase();
    if (input.mime === 'text/csv' || lower.endsWith('.csv') || input.mime === 'text/plain') {
      return parsePastedTable(input.buf.toString('utf-8'));
    }
    return parseQuickChartXlsx(input.buf);
  }
  return parsePastedTable(input.text ?? '');
}
