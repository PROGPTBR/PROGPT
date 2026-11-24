import ExcelJS from 'exceljs';
import JSZip from 'jszip';

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

export async function parseXlsxToMarkdown(buf: Buffer, maxRows: number = MAX_ROWS_PER_SHEET): Promise<string> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch (err) {
    // O ExcelJS quebra em planilhas com certos desenhos e logotipos (caso real:
    // a planilha de pendências de honorários de um hospital, com o logo no
    // topo). O conteúdo das células está intacto: lê direto do XML.
    console.warn('[xlsx] ExcelJS falhou, lendo o XML direto:', err instanceof Error ? err.message : err);
    return parseXlsxDireto(buf, maxRows);
  }

  const sections: string[] = [];
  for (const ws of wb.worksheets) {
    if (!ws || ws.state === 'hidden' || ws.state === 'veryHidden') continue;
    const rendered = renderSheet(ws, maxRows);
    if (rendered) sections.push(rendered);
  }

  if (sections.length === 0) {
    return '_(planilha vazia ou sem células legíveis)_';
  }
  return sections.join('\n\n');
}

function renderSheet(ws: ExcelJS.Worksheet, maxRows: number = MAX_ROWS_PER_SHEET): string | null {
  const rows = collectRows(ws);
  if (rows.length === 0) return null;

  const header = rows[0]!;
  const body = rows.slice(1, maxRows + 1);
  const truncated = rows.length - 1 > maxRows;
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
    out.push(`_… ${rows.length - 1 - maxRows} linha(s) adicional(is) omitida(s)_`);
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

const desescapar = (t: string) =>
  t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');

const textoDe = (xml: string) => desescapar([...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

function colunaDe(ref: string): number {
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Leitor mínimo de .xlsx (zip + XML), usado quando o ExcelJS não abre o
 * arquivo. Lê texto e número das células; data vem como o número de série do
 * Excel convertido para AAAA-MM-DD quando a célula tem cara de data.
 */
export async function parseXlsxDireto(buf: Buffer, maxRows: number = MAX_ROWS_PER_SHEET): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const ler = async (nome: string) => (await zip.file(nome)?.async('string')) ?? '';

  const compartilhadas = [...(await ler('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]!));
  const nomes = [...(await ler('xl/workbook.xml')).matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => desescapar(m[1]!));
  const arquivos = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

  const secoes: string[] = [];
  for (const [i, arquivo] of arquivos.entries()) {
    const xml = await ler(arquivo);
    const linhas: string[][] = [];
    for (const linha of xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
      const celulas: string[] = [];
      for (const c of linha[1]!.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const dentro = c[3] ?? '';
        const tipo = /t="(\w+)"/.exec(c[2] ?? '')?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(dentro)?.[1];
        let valor = tipo === 's' && v != null ? (compartilhadas[Number(v)] ?? '') : v != null ? desescapar(v) : textoDe(dentro);
        // Número de série de data do Excel (entre 1990 e 2100), sem casas decimais.
        if (!tipo && /^\d{5}$/.test(valor) && Number(valor) > 32874 && Number(valor) < 73051 && /s="\d+"/.test(c[2] ?? '')) {
          valor = new Date(Date.UTC(1899, 11, 30) + Number(valor) * 86_400_000).toISOString().slice(0, 10);
        }
        celulas[colunaDe(c[1]!)] = valor;
      }
      const cheia = Array.from(celulas, (x) => x ?? '');
      if (cheia.some((x) => x.trim())) linhas.push(cheia);
    }
    if (linhas.length === 0) continue;

    const largura = Math.min(Math.max(...linhas.map((l) => l.length)), MAX_COLS_PER_SHEET);
    const fmt = (l: string[]) => `| ${Array.from({ length: largura }, (_, k) => escapeCell(l[k] ?? '') || ' ').join(' | ')} |`;
    const corpo = linhas.slice(1, maxRows + 1);
    const out = [`# ${nomes[i] ?? `Planilha ${i + 1}`}`, fmt(linhas[0]!), `| ${Array.from({ length: largura }, () => '---').join(' | ')} |`, ...corpo.map(fmt)];
    if (linhas.length - 1 > maxRows) out.push('', `_… ${linhas.length - 1 - maxRows} linha(s) adicional(is) omitida(s)_`);
    secoes.push(out.join('\n'));
  }
  return secoes.length > 0 ? secoes.join('\n\n') : '_(planilha vazia ou sem células legíveis)_';
}
