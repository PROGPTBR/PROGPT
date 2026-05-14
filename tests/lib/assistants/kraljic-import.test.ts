import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseImportedItems } from '@/lib/assistants/kraljic-import';

async function makeGenericXlsxBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow([
    'Item',
    'Segmento',
    'Categoria',
    'Spend (R$ MM)',
    'Criticidade',
    'Especificações Técnicas',
    'Valor Cliente',
    'Estrutura',
    'Rivalidade',
    'Poder Barganha',
    'Substituição',
  ]);
  ws.addRow(['Mat. Prima 1', '(D)', 'Matéria-Prima', 60, 4, 1, 4, 3, 4, 4, 4]);
  ws.addRow(['Serviços TI', '(I)', 'TI', 3, 2, 1, 1, 1, 1, 2, 3]);
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}

async function makePgFormatBuffer(): Promise<Buffer> {
  // Synthesize the PG template's "DADOS" sheet structure
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('DADOS');
  // Row 2 col F sentinel string + Row 6 col A sentinel
  ws.getCell(2, 6).value = 'MATRIZ DE KRALJIC - Exemplo';
  ws.getCell(6, 1).value = 'SEGMENTO';
  // Data rows start at row 9, column positions match the PG template
  ws.getRow(9).getCell(1).value = '(D) Matéria-Prima';
  ws.getRow(9).getCell(2).value = 'Matéria-Prima 1';
  ws.getRow(9).getCell(3).value = 'Matéria-Prima 1';
  ws.getRow(9).getCell(4).value = 60;
  ws.getRow(9).getCell(7).value = 4; // criticality
  ws.getRow(9).getCell(8).value = 1; // technical
  ws.getRow(9).getCell(9).value = 4; // value
  ws.getRow(9).getCell(12).value = 3; // structure
  ws.getRow(9).getCell(13).value = 4; // rivalry
  ws.getRow(9).getCell(14).value = 4; // power
  ws.getRow(9).getCell(15).value = 4; // switching
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}

describe('parseImportedItems', () => {
  it('parses generic xlsx with recognizable headers', async () => {
    const buf = await makeGenericXlsxBuffer();
    const { items, warnings } = await parseImportedItems(buf);
    expect(items.length).toBe(2);
    expect(items[0]!.name).toBe('Mat. Prima 1');
    expect(items[0]!.spendMM).toBe(60);
    expect(items[0]!.criticality).toBe(4);
    expect(warnings.length).toBe(0);
  });

  it('detects Procurement Garage format (DADOS sheet + row positions)', async () => {
    const buf = await makePgFormatBuffer();
    const { items, warnings } = await parseImportedItems(buf);
    expect(items.length).toBe(1);
    expect(items[0]!.name).toBe('Matéria-Prima 1');
    expect(items[0]!.spendMM).toBe(60);
    expect(items[0]!.criticality).toBe(4);
    expect(items[0]!.supplierPower).toBe(4);
    expect(warnings.length).toBe(0);
  });

  it('warns on invalid rows but keeps valid ones', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow([
      'Item', 'Segmento', 'Categoria', 'Spend',
      'Criticidade', 'Especificações Técnicas', 'Valor Cliente',
      'Estrutura', 'Rivalidade', 'Poder Barganha', 'Substituição',
    ]);
    ws.addRow(['Valid', '', '', 5, 2, 2, 2, 2, 2, 2, 2]);
    ws.addRow(['Out of range', '', '', 5, 9, 2, 2, 2, 2, 2, 2]); // criticality 9 invalid
    const arr = await wb.xlsx.writeBuffer();
    const { items, warnings } = await parseImportedItems(Buffer.from(arr as ArrayBuffer));
    expect(items.length).toBe(1);
    expect(items[0]!.name).toBe('Valid');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('skips empty rows (blank name)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow([
      'Item', 'Segmento', 'Categoria', 'Spend',
      'Criticidade', 'Especificações Técnicas', 'Valor Cliente',
      'Estrutura', 'Rivalidade', 'Poder Barganha', 'Substituição',
    ]);
    ws.addRow(['A', '', '', 5, 1, 1, 1, 1, 1, 1, 1]);
    ws.addRow(['', '', '', '', '', '', '', '', '', '', '']);
    ws.addRow(['B', '', '', 5, 1, 1, 1, 1, 1, 1, 1]);
    const arr = await wb.xlsx.writeBuffer();
    const { items } = await parseImportedItems(Buffer.from(arr as ArrayBuffer));
    expect(items.length).toBe(2);
  });

  it('warns when required headers are missing', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['Some Random Header', 'Another']);
    ws.addRow(['data', 'more']);
    const arr = await wb.xlsx.writeBuffer();
    const { items, warnings } = await parseImportedItems(Buffer.from(arr as ArrayBuffer));
    expect(items.length).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
