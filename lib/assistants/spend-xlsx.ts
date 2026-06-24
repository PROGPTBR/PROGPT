import ExcelJS from 'exceljs';
import type { SpendAnalysisParams } from './types';
import type { SpendCube, SpendInvoiceRow } from '@/lib/spend/types';

// Workbook do Spend Analysis:
//   1. Base classificada — uma linha por invoice (todos os campos + flags)
//   2. Resumo — KPIs
//   3. Por categoria / 4. Por fornecedor / 5. Por país
//   6. Pareto — chart PNG (opcional)

export type SpendXlsxOpts = {
  chartPng?: Buffer;
  logo?: { buffer: Buffer; mime: 'image/png' | 'image/jpeg' };
};

const STATUS_LABEL: Record<string, string> = {
  done: 'OK',
  needs_review: 'Revisar',
  error: 'Erro',
  pending: 'Pendente',
  extracting: 'Extraindo',
};

export async function buildSpendXlsxBuffer(
  params: SpendAnalysisParams,
  rows: SpendInvoiceRow[],
  cube: SpendCube,
  opts: SpendXlsxOpts = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PROGPT';
  wb.created = new Date();
  const ref = cube.referenceCurrency;

  buildBaseSheet(wb, rows, ref);
  buildResumoSheet(wb, params, cube, opts.logo);
  buildBreakdownSheet(wb, 'Por categoria', cube.byCategory, ref);
  buildBreakdownSheet(wb, 'Por fornecedor', cube.bySupplier, ref);
  if (cube.byCountry.length > 1) buildBreakdownSheet(wb, 'Por país', cube.byCountry, ref);
  if (opts.chartPng) buildChartSheet(wb, opts.chartPng);

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}

function buildBaseSheet(wb: ExcelJS.Workbook, rows: SpendInvoiceRow[], ref: string): void {
  const ws = wb.addWorksheet('Base classificada');
  ws.columns = [
    { header: 'Nº invoice', key: 'inv', width: 16 },
    { header: 'PO', key: 'po', width: 14 },
    { header: 'Fornecedor', key: 'sup', width: 28 },
    { header: 'Categoria', key: 'cat', width: 28 },
    { header: 'País', key: 'country', width: 14 },
    { header: 'Moeda', key: 'ccy', width: 8 },
    { header: 'Total (orig.)', key: 'total', width: 14 },
    { header: `Total (${ref})`, key: 'ref', width: 16 },
    { header: 'Prazo', key: 'terms', width: 16 },
    { header: 'Data', key: 'date', width: 12 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Descrição', key: 'desc', width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const r of rows) {
    ws.addRow({
      inv: r.invoice_number ?? '',
      po: r.po_number ?? '',
      sup: r.supplier ?? '',
      cat: r.category ?? '',
      country: r.country ?? '',
      ccy: r.currency ?? '',
      total: r.total ?? null,
      ref: r.total_ref ?? null,
      terms: r.payment_terms ?? '',
      date: r.invoice_date ?? '',
      status: STATUS_LABEL[r.status] ?? r.status,
      desc: r.description ?? '',
    });
  }
  ws.getColumn('total').numFmt = '#,##0.00';
  ws.getColumn('ref').numFmt = '#,##0.00';
}

function buildResumoSheet(
  wb: ExcelJS.Workbook,
  params: SpendAnalysisParams,
  cube: SpendCube,
  logo?: { buffer: Buffer; mime: 'image/png' | 'image/jpeg' },
): void {
  const ws = wb.addWorksheet('Resumo');
  ws.columns = [
    { header: '', key: 'a', width: 30 },
    { header: '', key: 'b', width: 24 },
  ];
  if (logo) {
    const id = wb.addImage({
      buffer: logo.buffer as unknown as ArrayBuffer,
      extension: logo.mime === 'image/png' ? 'png' : 'jpeg',
    });
    ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 60 } });
  }
  ws.getCell('A4').value = 'Análise de Gastos — ' + params.analysisName;
  ws.getCell('A4').font = { size: 16, bold: true };
  const ref = cube.referenceCurrency;
  const kv: [string, string | number, string?][] = [
    ['Período', params.period || '—'],
    [`Gasto total (${ref})`, cube.totalRef, '#,##0.00'],
    ['Nº de invoices', cube.invoiceCount],
    ['Nº de fornecedores', cube.bySupplier.length],
    ['Ticket médio', cube.ticketMedio, '#,##0.00'],
    ['Invoices com PO', cube.poCoveragePct, '0.0%'],
    ['Gasto com PO', cube.poSpendPct, '0.0%'],
    ['Tail spend', cube.tailSpend.tailSpendRef, '#,##0.00'],
    ['Fornecedores na cauda', cube.tailSpend.suppliersBeyond80Pct],
  ];
  let row = 6;
  for (const [k, v, fmt] of kv) {
    ws.getCell(`A${row}`).value = k;
    ws.getCell(`A${row}`).font = { bold: true };
    const cell = ws.getCell(`B${row}`);
    cell.value = v;
    if (fmt) cell.numFmt = fmt;
    row++;
  }
}

function buildBreakdownSheet(
  wb: ExcelJS.Workbook,
  name: string,
  rows: { key: string; totalRef: number; pct: number; count: number }[],
  ref: string,
): void {
  const ws = wb.addWorksheet(name);
  ws.columns = [
    { header: name.replace('Por ', ''), key: 'key', width: 32 },
    { header: `Gasto (${ref})`, key: 'total', width: 18 },
    { header: '% do gasto', key: 'pct', width: 12 },
    { header: 'Notas', key: 'count', width: 10 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({ key: r.key, total: r.totalRef, pct: r.pct, count: r.count });
  }
  ws.getColumn('total').numFmt = '#,##0.00';
  ws.getColumn('pct').numFmt = '0.0%';
}

function buildChartSheet(wb: ExcelJS.Workbook, chartPng: Buffer): void {
  const ws = wb.addWorksheet('Pareto');
  const id = wb.addImage({ buffer: chartPng as unknown as ArrayBuffer, extension: 'png' });
  ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 900, height: 500 } });
}
