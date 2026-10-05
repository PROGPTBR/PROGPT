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
    // Sem CNPJ entra um AVISO informativo, não um erro.
    expect(warnings.some((w) => /obrigat/i.test(w))).toBe(false);
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

// Layout real de cliente (Construtora Costa Feitosa, 2026-10-05): título
// mesclado no topo, cabeçalho na linha 3, várias abas, cidade "Cidade - UF",
// sem CNPJ. A versão anterior devolvia "coluna obrigatória não detectada".
describe('parseVendorListXlsx — vendor list real de cliente', () => {
  async function workbookCliente(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    // 1ª aba: controle de cotações (cabeçalho na linha 8) — não é a base.
    const cot = wb.addWorksheet('1.0 VENDOR LIST');
    for (let i = 0; i < 7; i++) cot.addRow(i === 1 ? ['', '', 'VENDOR LIST ORÇAMENTÁRIA'] : []);
    cot.addRow(['Nº ORÇAMENTO', 'FORNECEDOR', 'E-MAIL', 'CONTATO', 'CELULAR/TELEFONE', 'SEGMENTO', 'STATUS']);
    cot.addRow(['0436', 'PEDREIRA X', 'a@x.com', 'LEVI', '11 3611-0240', 'AGREGADOS', 'DECLINOU']);
    // 2ª aba: a base de verdade.
    const forn = wb.addWorksheet('2.0 FORNECEDORES');
    forn.addRow(['FORNECEDORES - CONSTRUTORA']);
    forn.mergeCells('A1:G1');
    forn.addRow([]);
    forn.addRow(['GRUPO DE MATERIAIS', 'FORNECEDOR ', 'E-MAIL', 'CONTATO', 'CELULAR/TELEFONE', 'CIDADE', 'OBSERVAÇÕES']);
    forn.addRow(['AÇO', 'MESTRE AÇO', 'sp09@mestreaco.com', 'JOSÉ ADRIANO', '11 5464-1406', 'São Paulo - SP', 'Entrega em 48h']);
    forn.addRow(['ACM ', 'GUARU SIGN', 'Contato@GuaruSign.com.br', '', '11 4969-6006', 'Guarulhos - SP', '']);
    forn.addRow(['ACM', 'SÓ UF', '', '', '', 'SP', '(vazio)']);
    forn.addRow(['', '', '', '', '', '', '']);
    // 3ª aba: tabela dinâmica derivada — uma coluna só.
    wb.addWorksheet('3.0 PLANILHA FORNECEDORES').addRow(['FORNECEDORES']);
    return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  }

  it('acha a aba da base e o cabeçalho fora da linha 1', async () => {
    const { rows, warnings } = await parseVendorListXlsx(await workbookCliente());
    expect(warnings[0]).toMatch(/2\.0 FORNECEDORES.*linha 3/);
    expect(rows.map((r) => r.razaoSocial)).toEqual(['MESTRE AÇO', 'GUARU SIGN', 'SÓ UF']);
  });

  it('separa cidade e UF, guarda contato e observações e normaliza o e-mail', async () => {
    const { rows } = await parseVendorListXlsx(await workbookCliente());
    expect(rows[0]).toMatchObject({
      categoria: 'AÇO',
      municipio: 'São Paulo',
      uf: 'SP',
      telefone: '11 5464-1406',
      notas: 'Contato: JOSÉ ADRIANO · Entrega em 48h',
    });
    expect(rows[1]).toMatchObject({ categoria: 'ACM', email: 'contato@guarusign.com.br', notas: null });
    // "SP" sozinho na coluna de cidade é UF; "(vazio)" de tabela dinâmica é vazio.
    expect(rows[2]).toMatchObject({ municipio: null, uf: 'SP', notas: null });
  });

  it('avisa que não há CNPJ, sem tratar como erro', async () => {
    const { warnings } = await parseVendorListXlsx(await workbookCliente());
    expect(warnings.some((w) => /sem CNPJ/i.test(w))).toBe(true);
  });
});
