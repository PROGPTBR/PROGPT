import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseXlsxToMarkdown } from '@/lib/chat-attachments/xlsx';

async function buildWorkbook(
  sheets: Array<{ name: string; rows: Array<Array<string | number>> }>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    for (const r of s.rows) ws.addRow(r);
  }
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}

describe('parseXlsxToMarkdown', () => {
  it('emits a section per sheet with first row as header', async () => {
    const buf = await buildWorkbook([
      {
        name: 'Fornecedores',
        rows: [
          ['Nome', 'Spend', 'País'],
          ['Acme', 100, 'BR'],
          ['Globex', 50, 'US'],
        ],
      },
    ]);
    const md = await parseXlsxToMarkdown(buf);
    expect(md).toContain('# Fornecedores');
    expect(md).toContain('| Nome | Spend | País |');
    expect(md).toContain('| --- | --- | --- |');
    expect(md).toContain('| Acme | 100 | BR |');
    expect(md).toContain('| Globex | 50 | US |');
  });

  it('handles multiple sheets in order', async () => {
    const buf = await buildWorkbook([
      { name: 'Sheet1', rows: [['A'], ['1']] },
      { name: 'Sheet2', rows: [['B'], ['2']] },
    ]);
    const md = await parseXlsxToMarkdown(buf);
    const i1 = md.indexOf('# Sheet1');
    const i2 = md.indexOf('# Sheet2');
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i2).toBeGreaterThan(i1);
  });

  it('skips fully empty rows', async () => {
    const buf = await buildWorkbook([
      {
        name: 'Sparse',
        rows: [
          ['Header'],
          ['First'],
          // empty (no row added)
          ['Last'],
        ],
      },
    ]);
    const md = await parseXlsxToMarkdown(buf);
    expect(md).toContain('| First |');
    expect(md).toContain('| Last |');
  });

  it('escapes pipe characters inside cells', async () => {
    const buf = await buildWorkbook([
      {
        name: 'Pipes',
        rows: [
          ['col'],
          ['a | b'],
        ],
      },
    ]);
    const md = await parseXlsxToMarkdown(buf);
    // pipe inside cell should be \|
    expect(md).toContain('a \\| b');
  });

  it('returns the empty-workbook fallback when no rows', async () => {
    const buf = await buildWorkbook([{ name: 'Empty', rows: [] }]);
    const md = await parseXlsxToMarkdown(buf);
    expect(md).toMatch(/planilha vazia/i);
  });

  it('truncates a sheet that exceeds 200 data rows and appends a marker', async () => {
    const rows: Array<Array<string | number>> = [['Header']];
    for (let i = 0; i < 250; i++) rows.push([`row-${i}`]);
    const buf = await buildWorkbook([{ name: 'Big', rows }]);
    const md = await parseXlsxToMarkdown(buf);
    expect(md).toMatch(/linha\(s\) adicional\(is\) omitida\(s\)/);
    // First row visible
    expect(md).toContain('| row-0 |');
    // Last visible row should be row-199
    expect(md).toContain('| row-199 |');
    // row-249 should NOT appear (it was truncated)
    expect(md).not.toContain('| row-249 |');
  });
});
