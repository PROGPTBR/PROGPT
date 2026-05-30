import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildScorecardXlsxBuffer } from '@/lib/assistants/scorecard-xlsx';
import { scoreSuppliers } from '@/lib/assistants/scorecard';
import { SCORECARD_DEFAULT_THRESHOLDS } from '@/lib/assistants/types';
import type { ScorecardParams } from '@/lib/assistants/types';

const p: ScorecardParams = {
  scorecardName: 'Aço', period: '', notes: '', thresholds: SCORECARD_DEFAULT_THRESHOLDS,
  criteria: [{ id: 'q', label: 'Qualidade', weight: 60 }, { id: 'pr', label: 'Preço', weight: 40 }],
  suppliers: [
    { name: 'A', segment: '', scores: { q: 9, pr: 7 } },
    { name: 'B', segment: '', scores: { q: 4, pr: 5 } },
  ],
};

describe('buildScorecardXlsxBuffer', () => {
  it('produces Scorecard and Ranking sheets with PROGPT creator', async () => {
    const buf = await buildScorecardXlsxBuffer(p, scoreSuppliers(p));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Scorecard')).toBeTruthy();
    expect(wb.getWorksheet('Ranking')).toBeTruthy();
    expect(wb.creator).toBe('PROGPT');
  });
  it('adds a Gráfico sheet when chartPng is provided', async () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex'); // minimal PNG header bytes
    const buf = await buildScorecardXlsxBuffer(p, scoreSuppliers(p), { chartPng: png });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Gráfico')).toBeTruthy();
  });

  it('Scorecard header spans Fornecedor + N criteria + Score + Rank + Faixa', async () => {
    const buf = await buildScorecardXlsxBuffer(p, scoreSuppliers(p));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Scorecard')!;
    let headerVals: unknown[] = [];
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Fornecedor') {
        headerVals = (row.values as unknown[]).slice(1);
      }
    });
    expect(headerVals).toHaveLength(p.criteria.length + 4);
    expect(headerVals[headerVals.length - 1]).toBe('Faixa');
  });
});
