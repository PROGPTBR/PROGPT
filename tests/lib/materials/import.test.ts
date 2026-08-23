import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseMaterialsXlsx } from '@/lib/materials/import';

async function buf(rows: unknown[][], sheetName = 'Materiais'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  for (const r of rows) ws.addRow(r);
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

describe('parseMaterialsXlsx', () => {
  it('parses recognized headers and coerces pt-BR price', async () => {
    const b = await buf([
      ['Código', 'Descrição', 'Categoria', 'Unidade', 'NCM', 'Preço'],
      ['SKU-1', 'Chapa de aço 1mm', 'Metais', 'UN', '7208.10.00', '1.234,56'],
    ]);
    const { rows, warnings } = await parseMaterialsXlsx(b);
    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      codigo: 'SKU-1',
      descricao: 'Chapa de aço 1mm',
      categoria: 'Metais',
      unidade: 'UN',
      ncm: '72081000',
      precoUltimo: 1234.56,
    });
  });

  it('accepts en-US decimal format too', async () => {
    const b = await buf([
      ['Descrição', 'Preço'],
      ['Parafuso M6', '1,234.56'],
    ]);
    const { rows } = await parseMaterialsXlsx(b);
    expect(rows[0]!.precoUltimo).toBeCloseTo(1234.56);
  });

  it('descrição é a única coluna obrigatória — demais ausentes viram null', async () => {
    const b = await buf([
      ['Descrição'],
      ['Item genérico'],
    ]);
    const { rows, warnings } = await parseMaterialsXlsx(b);
    expect(warnings).toEqual([]);
    expect(rows[0]).toMatchObject({
      codigo: null,
      descricao: 'Item genérico',
      categoria: null,
      unidade: null,
      ncm: null,
      fornecedorPadraoCnpj: null,
      precoUltimo: null,
      moeda: null,
    });
  });

  it('sem coluna de descrição reconhecível → warning e rows vazio', async () => {
    const b = await buf([
      ['Coluna X', 'Coluna Y'],
      ['a', 'b'],
    ]);
    const { rows, warnings } = await parseMaterialsXlsx(b);
    expect(rows).toEqual([]);
    expect(warnings.some((w) => /descrição/i.test(w))).toBe(true);
  });

  it('pula linhas sem descrição', async () => {
    const b = await buf([
      ['Descrição'],
      [''],
      ['Item válido'],
    ]);
    const { rows } = await parseMaterialsXlsx(b);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.descricao).toBe('Item válido');
  });

  it('normaliza CNPJ do fornecedor padrão (remove máscara)', async () => {
    const b = await buf([
      ['Descrição', 'CNPJ Fornecedor'],
      ['Item', '12.345.678/0001-90'],
    ]);
    const { rows } = await parseMaterialsXlsx(b);
    expect(rows[0]!.fornecedorPadraoCnpj).toBe('12345678000190');
  });

  it('usa a aba "Materiais" se existir, senão a primeira', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Outra').addRow(['Descrição']).commit();
    const materiaisWs = wb.addWorksheet('Materiais');
    materiaisWs.addRow(['Descrição']);
    materiaisWs.addRow(['Item da aba certa']);
    const b = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const { rows } = await parseMaterialsXlsx(b);
    expect(rows[0]!.descricao).toBe('Item da aba certa');
  });
});
