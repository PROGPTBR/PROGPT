import ExcelJS from 'exceljs';

// Generic XLSX → Markdown converter for chat attachments.
//
// Walks every sheet in the workbook and emits a Markdown section per sheet:
//   # {sheetName}
//   | col1 | col2 | ... |
//   | --- | --- | --- |
//   | val1 | val2 | ... |
//
// First non-empty row of each sheet is treated as the header. Empty rows are
// skipped. Cells with formulas are rendered as their computed value
// (cell.value's `.result` for ResultValue, raw otherwise). Cells holding
// dates are formatted as ISO-8601 dates.

const MAX_ROWS_PER_SHEET = 200;   // truncation guard for huge workbooks
const MAX_COLS_PER_SHEET = 30;    // wide sheets get clipped

export async function parseXlsxToMarkdown(buf: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);

  const sections: string[] = [];
  for (const ws of wb.worksheets) {
    if (!ws || ws.state === 'hidden' || ws.state === 'veryHidden') continue;
    const rendered = renderSheet(ws);
    if (rendered) sections.push(rendered);
  }

  if (sections.length === 0) {
    return '_(planilha vazia ou sem células legíveis)_';
  }
  return sections.join('\n\n');
}

function renderSheet(ws: ExcelJS.Worksheet): string | null {
  const rows = collectRows(ws);
  if (rows.length === 0) return null;

  const header = rows[0]!;
  const body = rows.slice(1, MAX_ROWS_PER_SHEET + 1);
  const truncated = rows.length - 1 > MAX_ROWS_PER_SHEET;
  const colCount = Math.min(header.length, MAX_COLS_PER_SHEET);

  const out: string[] = [`# ${ws.name}`];
  const headerCells = header
    .slice(0, colCount)
    .map((c) => escapeCell(c) || ' ');
  out.push(`| ${headerCells.join(' | ')} |`);
  out.push(`| ${headerCells.map(() => '---').join(' | ')} |`);

  for (const r of body) {
    const cells = r.slice(0, colCount).map((c) => escapeCell(c));
    while (cells.length < colCount) cells.push('');
    out.push(`| ${cells.join(' | ')} |`);
  }

  if (truncated) {
    out.push('');
    out.push(`_… ${rows.length - 1 - MAX_ROWS_PER_SHEET} linha(s) adicional(is) omitida(s)_`);
  }
  return out.join('\n');
}

/**
 * Pull each row's cell values into a string[][], dropping any rows that are
 * entirely empty. ExcelJS rows are 1-indexed; eachRow with includeEmpty
 * false handles sparse rows for us.
 */
function collectRows(ws: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const arr: string[] = [];
    let maxCol = 0;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber > maxCol) maxCol = colNumber;
      arr[colNumber - 1] = formatCell(cell);
    });
    if (maxCol === 0) return;
    for (let i = 0; i < maxCol; i++) {
      if (arr[i] === undefined) arr[i] = '';
    }
    // Skip rows whose cells are all whitespace.
    if (arr.every((c) => c.trim() === '')) return;
    rows.push(arr);
  });
  return rows;
}

function formatCell(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Formula cells expose `{ formula, result }`.
  const maybeResult = (v as { result?: unknown }).result;
  if (maybeResult !== undefined && maybeResult !== null) {
    if (typeof maybeResult === 'object' && 'text' in (maybeResult as object)) {
      return String((maybeResult as { text: unknown }).text ?? '');
    }
    return String(maybeResult);
  }
  // Rich text / hyperlink.
  const maybeText = (v as { text?: unknown }).text;
  if (typeof maybeText === 'string') return maybeText;
  return '';
}

function escapeCell(s: string): string {
  // Keep markdown tables readable: collapse newlines, escape pipes.
  return s.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}
