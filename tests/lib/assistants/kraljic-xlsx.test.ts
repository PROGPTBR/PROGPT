import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildKraljicXlsxBuffer } from '@/lib/assistants/kraljic-xlsx';
import { classifyItems } from '@/lib/assistants/kraljic';
import type { KraljicItem, KraljicParams } from '@/lib/assistants/types';

const items: KraljicItem[] = [
  { name: 'A', segment: 'D', category: 'cat',
    spendMM: 60, criticality: 4, technicalSpec: 1, customerValue: 4,
    marketStructure: 3, marketRivalry: 4, supplierPower: 4, supplierSwitching: 4 },
  { name: 'B', segment: 'I', category: 'cat',
    spendMM: 1, criticality: 1, technicalSpec: 1, customerValue: 1,
    marketStructure: 1, marketRivalry: 1, supplierPower: 1, supplierSwitching: 1 },
];
const params: KraljicParams = { portfolioName: 'Test', analysisPeriod: '', notes: '', items };

describe('buildKraljicXlsxBuffer', () => {
  it('returns a non-empty Buffer with the xlsx ZIP signature (PK)', async () => {
    const classified = classifyItems(items);
    const buf = await buildKraljicXlsxBuffer(params, classified);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('produces 4 worksheets (Resumo / Matriz / Itens / Plano de Ação)', async () => {
    const classified = classifyItems(items);
    const buf = await buildKraljicXlsxBuffer(params, classified);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toContain('Resumo');
    expect(names).toContain('Matriz');
    expect(names).toContain('Itens');
    expect(names).toContain('Plano de Ação');
  });

  it('grows in size when a chart PNG is embedded', async () => {
    const classified = classifyItems(items);
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=',
      'base64',
    );
    const withChart = await buildKraljicXlsxBuffer(params, classified, { chartPng: tinyPng });
    const without = await buildKraljicXlsxBuffer(params, classified);
    expect(withChart.length).toBeGreaterThan(without.length);
  });
});
