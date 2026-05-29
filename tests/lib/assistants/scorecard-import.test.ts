import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseScorecardXlsx } from '@/lib/assistants/scorecard-import';

async function buf(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Scorecard');
  ws.addRow(['Fornecedor', 'Qualidade', 'Preço', 'Prazo']);
  ws.addRow(['Forn A', 9, 7, 8]);
  ws.addRow(['Forn B', '5,5', 6, 4]);
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

describe('parseScorecardXlsx', () => {
  it('derives criteria from headers and suppliers with 0-10 scores', async () => {
    const { criteria, suppliers, warnings } = await parseScorecardXlsx(await buf());
    expect(criteria.map((c) => c.label)).toEqual(['Qualidade', 'Preço', 'Prazo']);
    expect(criteria.every((c) => c.weight > 0)).toBe(true);
    expect(criteria.reduce((a, c) => a + c.weight, 0)).toBe(100);
    expect(suppliers).toHaveLength(2);
    expect(suppliers[0]!.name).toBe('Forn A');
    expect(suppliers[0]!.scores[criteria[0]!.id]).toBe(9);
    expect(suppliers[1]!.scores[criteria[0]!.id]).toBeCloseTo(5.5);
    expect(warnings).toEqual([]);
  });

  it('clamps out-of-range scores to 0-10 and warns', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Scorecard');
    ws.addRow(['Fornecedor', 'Qualidade']);
    ws.addRow(['X', 99]);
    const b = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const { suppliers, warnings } = await parseScorecardXlsx(b);
    const cid = Object.keys(suppliers[0]!.scores)[0]!;
    expect(suppliers[0]!.scores[cid]).toBe(10);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('skips blank supplier rows', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Scorecard');
    ws.addRow(['Fornecedor', 'Qualidade']);
    ws.addRow(['', 5]);
    ws.addRow(['Real', 8]);
    const b = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const { suppliers } = await parseScorecardXlsx(b);
    expect(suppliers).toHaveLength(1);
    expect(suppliers[0]!.name).toBe('Real');
  });
});
