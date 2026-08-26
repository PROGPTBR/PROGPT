import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  parsePastedTable,
  parseQuickChartXlsx,
  parseQuickChartInput,
} from '@/lib/charts/quick-chart-parse';

describe('parsePastedTable', () => {
  it('parses tab-delimited pasted data (Excel copy-paste default)', () => {
    const { table, warnings } = parsePastedTable(
      'Fornecedor\tGasto\nACME Ltda\t120000\nGlobex SA\t80500',
    );
    expect(table.headers).toEqual(['Fornecedor', 'Gasto']);
    expect(table.rows).toEqual([
      ['ACME Ltda', '120000'],
      ['Globex SA', '80500'],
    ]);
    expect(warnings).toEqual([]);
  });

  it('parses semicolon-delimited data (common pt-BR CSV export)', () => {
    const { table } = parsePastedTable('Categoria;Valor\nTI;1000\nFacilities;500');
    expect(table.headers).toEqual(['Categoria', 'Valor']);
    expect(table.rows).toEqual([
      ['TI', '1000'],
      ['Facilities', '500'],
    ]);
  });

  it('parses comma-delimited data', () => {
    const { table } = parsePastedTable('Item,Qtd\nParafuso,10\nPorca,20');
    expect(table.headers).toEqual(['Item', 'Qtd']);
    expect(table.rows[0]).toEqual(['Parafuso', '10']);
  });

  it('parses a markdown table, dropping the separator row', () => {
    const md = [
      '| Fornecedor | Gasto |',
      '| --- | --- |',
      '| ACME | 120000 |',
      '| Globex | 80500 |',
    ].join('\n');
    const { table } = parsePastedTable(md);
    expect(table.headers).toEqual(['Fornecedor', 'Gasto']);
    expect(table.rows).toEqual([
      ['ACME', '120000'],
      ['Globex', '80500'],
    ]);
  });

  it('warns and returns empty table when fewer than 2 columns', () => {
    const { table, warnings } = parsePastedTable('SoUmaColuna\nvalor1\nvalor2');
    expect(table.rows).toEqual([]);
    expect(warnings[0]).toMatch(/pelo menos 2 colunas/);
  });

  it('warns and returns empty table when there is no data line', () => {
    const { table, warnings } = parsePastedTable('Só um cabeçalho');
    expect(table.headers).toEqual([]);
    expect(warnings[0]).toMatch(/cabeçalho.*linha de dado/);
  });

  it('skips a prose preamble before a tab-delimited table (chat message case)', () => {
    // Reproduz o texto real de uma mensagem do chat: frase + tabela colada
    // logo abaixo, sem separador especial entre as duas.
    const { table, warnings } = parsePastedTable(
      'Monte um gráfico com esses dados:\nFornecedor\tGasto\nACME Ltda\t120000\nGlobex SA\t80500',
    );
    expect(table.headers).toEqual(['Fornecedor', 'Gasto']);
    expect(table.rows).toEqual([
      ['ACME Ltda', '120000'],
      ['Globex SA', '80500'],
    ]);
    expect(warnings).toEqual([]);
  });

  it('skips a prose preamble before a markdown table', () => {
    const md = [
      'Aqui está o gráfico que você pediu:',
      '| Fornecedor | Gasto |',
      '| --- | --- |',
      '| ACME | 120000 |',
    ].join('\n');
    const { table } = parsePastedTable(md);
    expect(table.headers).toEqual(['Fornecedor', 'Gasto']);
    expect(table.rows).toEqual([['ACME', '120000']]);
  });

  it('does not let an incidental comma in the preamble hijack the header detection', () => {
    // A vírgula em "Segue, com os dados abaixo" não deve virar cabeçalho —
    // a tabela real (tab-delimitada) começa na linha seguinte.
    const { table } = parsePastedTable(
      'Segue, com os dados abaixo:\nCategoria\tValor\nTI\t1000\nFacilities\t500',
    );
    expect(table.headers).toEqual(['Categoria', 'Valor']);
    expect(table.rows.length).toBe(2);
  });

  it('caps at 500 rows with a warning', () => {
    const lines = ['A\tB', ...Array.from({ length: 600 }, (_, i) => `l${i}\t${i}`)];
    const { table, warnings } = parsePastedTable(lines.join('\n'));
    expect(table.rows.length).toBe(500);
    expect(warnings.some((w) => w.includes('500'))).toBe(true);
  });
});

describe('parseQuickChartXlsx', () => {
  async function buildXlsxBuffer(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['Fornecedor', 'Gasto']);
    ws.addRow(['ACME', 120000]);
    ws.addRow(['Globex', 80500.5]);
    const arr = await wb.xlsx.writeBuffer();
    return Buffer.from(arr);
  }

  it('parses headers and numeric/text cells from the first worksheet', async () => {
    const buf = await buildXlsxBuffer();
    const { table, warnings } = await parseQuickChartXlsx(buf);
    expect(table.headers).toEqual(['Fornecedor', 'Gasto']);
    expect(table.rows).toEqual([
      ['ACME', 120000],
      ['Globex', 80500.5],
    ]);
    expect(warnings).toEqual([]);
  });
});

describe('parseQuickChartInput dispatcher', () => {
  it('routes .csv filename to the pasted-table parser', async () => {
    const buf = Buffer.from('A;B\nfoo;1\n', 'utf-8');
    const { table } = await parseQuickChartInput({ buf, mime: 'text/csv', filename: 'dados.csv' });
    expect(table.headers).toEqual(['A', 'B']);
  });

  it('routes anything else with a buffer to the XLSX parser', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.addRow(['X', 'Y']);
    ws.addRow(['a', 1]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const { table } = await parseQuickChartInput({
      buf,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'dados.xlsx',
    });
    expect(table.headers).toEqual(['X', 'Y']);
  });

  it('falls back to pasted-text parsing when no buffer is given', async () => {
    const { table } = await parseQuickChartInput({ text: 'A\tB\nfoo\t1' });
    expect(table.headers).toEqual(['A', 'B']);
  });
});
