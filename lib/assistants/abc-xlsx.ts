import ExcelJS from 'exceljs';
import type { AbcAnalysis, AbcParams, AbcClass } from './types';
import { ABC_CLASS_LABELS } from './types';

// Sub-projeto 31 — Workbook ABC com 3 abas:
//   1. Resumo — totais por classe + parâmetros
//   2. Itens ordenados — todos os items ranqueados com classe atribuída
//   3. Curva ABC — chart PNG (opcional) + plano de ação resumido por classe

export type AbcXlsxOpts = {
  chartPng?: Buffer;
  logo?: { buffer: Buffer; mime: 'image/png' | 'image/jpeg' };
};

export async function buildAbcXlsxBuffer(
  params: AbcParams,
  analysis: AbcAnalysis,
  opts: AbcXlsxOpts = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PROGPT';
  wb.created = new Date();

  buildResumoSheet(wb, params, analysis, opts.logo);
  buildItensSheet(wb, analysis);
  buildCurvaSheet(wb, analysis, opts.chartPng);

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}

function buildResumoSheet(
  wb: ExcelJS.Workbook,
  params: AbcParams,
  analysis: AbcAnalysis,
  logo?: { buffer: Buffer; mime: 'image/png' | 'image/jpeg' },
): void {
  const ws = wb.addWorksheet('Resumo');
  ws.columns = [
    { header: '', key: 'a', width: 6 },
    { header: '', key: 'b', width: 30 },
    { header: '', key: 'c', width: 20 },
    { header: '', key: 'd', width: 20 },
    { header: '', key: 'e', width: 20 },
  ];

  if (logo) {
    const imageId = wb.addImage({
      buffer: logo.buffer as unknown as ArrayBuffer,
      extension: logo.mime === 'image/png' ? 'png' : 'jpeg',
    });
    ws.addImage(imageId, {
      tl: { col: 1, row: 0 },
      ext: { width: 120, height: 60 },
    });
  }

  ws.getCell('B2').value = 'Análise ABC — ' + params.analysisName;
  ws.getCell('B2').font = { size: 16, bold: true };

  ws.getCell('B4').value = 'Período';
  ws.getCell('C4').value = params.analysisPeriod || '—';
  ws.getCell('B5').value = 'Itens distintos';
  ws.getCell('C5').value = analysis.totalItems;
  ws.getCell('B6').value = 'Spend total';
  ws.getCell('C6').value = analysis.totalSpend;
  ws.getCell('C6').numFmt = '"R$"#,##0.00';
  ws.getCell('B7').value = 'Consolidação';
  ws.getCell('C7').value = params.consolidate ? 'sim' : 'não';

  // Class table
  const header = ws.getRow(10);
  header.values = ['', 'Classe', 'Itens', '% Itens', 'Spend', '% Spend'];
  header.font = { bold: true };

  let r = 11;
  for (const c of ['A', 'B', 'C'] as AbcClass[]) {
    const s = analysis.byClass[c];
    const row = ws.getRow(r);
    row.getCell(2).value = ABC_CLASS_LABELS[c];
    row.getCell(3).value = s.count;
    row.getCell(4).value = s.itemShare;
    row.getCell(4).numFmt = '0.0%';
    row.getCell(5).value = s.totalSpend;
    row.getCell(5).numFmt = '"R$"#,##0.00';
    row.getCell(6).value = s.spendShare;
    row.getCell(6).numFmt = '0.0%';
    r++;
  }
  // Total row
  const total = ws.getRow(r);
  total.getCell(2).value = 'Total';
  total.getCell(3).value = analysis.totalItems;
  total.getCell(5).value = analysis.totalSpend;
  total.getCell(5).numFmt = '"R$"#,##0.00';
  total.font = { bold: true };
}

function buildItensSheet(wb: ExcelJS.Workbook, analysis: AbcAnalysis): void {
  const ws = wb.addWorksheet('Itens ordenados');
  ws.columns = [
    { header: '#', key: 'rank', width: 6 },
    { header: 'Classe', key: 'class', width: 8 },
    { header: 'Item', key: 'name', width: 50 },
    { header: 'Fornecedor', key: 'supplier', width: 30 },
    { header: 'Categoria', key: 'category', width: 20 },
    { header: 'Qtd', key: 'qty', width: 10 },
    { header: 'Un', key: 'unit', width: 8 },
    { header: 'Spend (R$)', key: 'spend', width: 18 },
    { header: '%', key: 'share', width: 10 },
    { header: '% Cum.', key: 'cum', width: 10 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const it of analysis.items) {
    ws.addRow({
      rank: it.rank,
      class: it.abcClass,
      name: it.name,
      supplier: it.supplier,
      category: it.category,
      qty: it.quantity ?? '',
      unit: it.unit,
      spend: it.spend,
      share: it.share,
      cum: it.cumulativeShare,
    });
  }
  ws.getColumn('spend').numFmt = '"R$"#,##0.00';
  ws.getColumn('share').numFmt = '0.00%';
  ws.getColumn('cum').numFmt = '0.00%';

  // Freeze the header so the user can scroll long lists.
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function buildCurvaSheet(
  wb: ExcelJS.Workbook,
  analysis: AbcAnalysis,
  chartPng?: Buffer,
): void {
  const ws = wb.addWorksheet('Curva ABC');
  ws.columns = [{ header: '', key: 'a', width: 6 }];

  ws.getCell('B2').value = 'Curva ABC — visualização';
  ws.getCell('B2').font = { size: 16, bold: true };

  if (chartPng) {
    const imageId = wb.addImage({
      buffer: chartPng as unknown as ArrayBuffer,
      extension: 'png',
    });
    ws.addImage(imageId, {
      tl: { col: 1, row: 4 },
      ext: { width: 720, height: 400 },
    });
  } else {
    ws.getCell('B4').value =
      '(chart PNG não incluído — gere o documento via /api/assistants/runs/[id]/xlsx para incluir)';
    ws.getCell('B4').font = { italic: true };
  }

  // Quick action plan reference below the chart.
  const r0 = chartPng ? 28 : 6;
  ws.getCell(`B${r0}`).value = 'Plano de ação por classe (resumo)';
  ws.getCell(`B${r0}`).font = { bold: true };
  ws.getCell(`B${r0 + 1}`).value =
    'A — Gestão estratégica: sourcing competitivo, contratos plurianuais, QBR ativo.';
  ws.getCell(`B${r0 + 2}`).value =
    'B — Gestão operacional: RFQ trimestral, 2-3 fornecedores qualificados.';
  ws.getCell(`B${r0 + 3}`).value =
    'C — Automatização: catálogo eletrônico, consolidação de pedidos, distribuidor.';

  ws.getCell(`B${r0 + 5}`).value = `Total de itens analisados: ${analysis.totalItems}`;
  ws.getCell(`B${r0 + 6}`).value = `Spend total: R$ ${analysis.totalSpend.toFixed(2)}`;
}
