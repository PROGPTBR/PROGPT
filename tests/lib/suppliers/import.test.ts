import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseVendorListXlsx } from '@/lib/suppliers/import';

async function buf(rows: unknown[][], sheetName = 'Fornecedores'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  for (const r of rows) ws.addRow(r);
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

describe('parseVendorListXlsx', () => {
  it('parses recognized headers and normalizes CNPJ/UF', async () => {
    const b = await buf([
      ['Razão Social', 'CNPJ', 'UF', 'Município', 'Categoria', 'Telefone', 'Email'],
      ['Acelor Mittal Ltda', '12.345.678/0001-90', 'sp', 'São Paulo', 'Metais', '(11) 4444-5555', 'contato@acelor.com'],
    ]);
    const { rows, warnings } = await parseVendorListXlsx(b);
    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      razaoSocial: 'Acelor Mittal Ltda',
      cnpj: '12345678000190',
      uf: 'SP',
      municipio: 'São Paulo',
      categoria: 'Metais',
      email: 'contato@acelor.com',
    });
  });

  it('razão social é a única coluna obrigatória', async () => {
    const b = await buf([
      ['Nome'],
      ['Fornecedor Genérico'],
    ]);
    const { rows, warnings } = await parseVendorListXlsx(b);
    expect(warnings).toEqual([]);
    expect(rows[0]).toMatchObject({ razaoSocial: 'Fornecedor Genérico', cnpj: null });
  });

  it('sem coluna reconhecível → warning e rows vazio', async () => {
    const b = await buf([
      ['X', 'Y'],
      ['a', 'b'],
    ]);
    const { rows, warnings } = await parseVendorListXlsx(b);
    expect(rows).toEqual([]);
    expect(warnings.some((w) => /razão social/i.test(w))).toBe(true);
  });

  it('pula linhas sem razão social', async () => {
    const b = await buf([
      ['Fornecedor'],
      [''],
      ['Fornecedor Válido'],
    ]);
    const { rows } = await parseVendorListXlsx(b);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.razaoSocial).toBe('Fornecedor Válido');
  });

  it('usa a aba "Fornecedores" se existir, senão a primeira', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Outra').addRow(['Fornecedor']).commit();
    const ws = wb.addWorksheet('Fornecedores');
    ws.addRow(['Fornecedor']);
    ws.addRow(['Da aba certa']);
    const b = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const { rows } = await parseVendorListXlsx(b);
    expect(rows[0]!.razaoSocial).toBe('Da aba certa');
  });
});
