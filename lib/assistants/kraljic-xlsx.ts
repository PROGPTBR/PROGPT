import ExcelJS from 'exceljs';
import type { ClassifiedKraljicItem, KraljicParams } from './types';
import { KRALJIC_QUADRANT_LABELS } from './types';
import { summarizeQuadrants } from './kraljic';
import type { XlsxLogo } from './xlsx';

// Sub-projeto 27 — Multi-sheet Kraljic workbook.
//
// 4 sheets:
//   1. Itens        — all input fields + computed scores + quadrant
//   2. Matriz       — embedded bubble chart PNG + per-quadrant stats
//   3. Plano Ação   — per-item recommendation (Estratégico + Gargalo)
//   4. Resumo       — banner with portfolio metadata
//
// `opts.chartPng` is the PNG produced by lib/assistants/kraljic-chart.ts.
// `opts.logo` mirrors the xlsx.ts pattern for RFP — placed in the banner
// of the Resumo sheet.

const COL_HEADER_FILL = 'FF1F4E78';
const COL_HEADER_FONT_COLOR = 'FFFFFFFF';

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COL_HEADER_FONT_COLOR } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL_HEADER_FILL } };
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  row.height = 32;
}

function thinBorders(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'hair', color: { argb: 'FFCCCCCC' } },
    left: { style: 'hair', color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
    right: { style: 'hair', color: { argb: 'FFCCCCCC' } },
  };
}

export async function buildKraljicXlsxBuffer(
  params: KraljicParams,
  classified: ClassifiedKraljicItem[],
  opts: { logo?: XlsxLogo; chartPng?: Buffer } = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ProcurementGPT';
  wb.created = new Date();

  const totalSpend = classified.reduce((a, it) => a + it.spendMM, 0);
  const summary = summarizeQuadrants(classified);

  // ─── Sheet 1 — Resumo ────────────────────────────────────────────────
  const resumo = wb.addWorksheet('Resumo', {
    pageSetup: { paperSize: 9, orientation: 'portrait' },
  });
  resumo.columns = [
    { key: 'a', width: 32 },
    { key: 'b', width: 18 },
    { key: 'c', width: 18 },
    { key: 'd', width: 18 },
  ];

  // Banner row
  resumo.mergeCells('A1:D1');
  resumo.getCell('A1').value = opts.logo ? '' : `Análise Kraljic — ${params.portfolioName}`;
  resumo.getCell('A1').font = { bold: true, size: 14 };
  resumo.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  resumo.getRow(1).height = 28;

  if (opts.logo) {
    const imageId = wb.addImage({
      buffer: opts.logo.buffer as unknown as ArrayBuffer,
      extension: opts.logo.mime === 'image/png' ? 'png' : 'jpeg',
    });
    resumo.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 160, height: 28 } });
  }

  resumo.mergeCells('A2:D2');
  resumo.getCell('A2').value = `Portfólio: ${params.portfolioName}`;
  resumo.getCell('A2').font = { bold: true };

  resumo.mergeCells('A3:D3');
  resumo.getCell('A3').value = `Total de itens: ${classified.length} · Spend total: R$ ${totalSpend.toFixed(2)} MM`;

  resumo.addRow([]);
  const sumHeader = resumo.addRow(['Quadrante', '# itens', 'Spend (R$ MM)', '% do portfólio']);
  styleHeader(sumHeader);
  const quadrants: (keyof typeof summary)[] = [
    'estrategico', 'alavancavel', 'gargalo', 'nao-critico',
  ];
  for (const q of quadrants) {
    const s = summary[q];
    const pct = totalSpend === 0 ? 0 : (s.spendMM / totalSpend) * 100;
    const r = resumo.addRow([
      KRALJIC_QUADRANT_LABELS[q],
      s.count,
      Number(s.spendMM.toFixed(2)),
      Number(pct.toFixed(1)),
    ]);
    r.eachCell((c) => thinBorders(c));
  }

  if (params.notes) {
    resumo.addRow([]);
    resumo.mergeCells(`A${resumo.lastRow!.number + 1}:D${resumo.lastRow!.number + 1}`);
    const noteRow = resumo.addRow([`Notas: ${params.notes}`]);
    noteRow.getCell(1).alignment = { wrapText: true };
  }

  // ─── Sheet 2 — Matriz (bubble chart) ─────────────────────────────────
  const matriz = wb.addWorksheet('Matriz', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });
  matriz.mergeCells('A1:H1');
  matriz.getCell('A1').value = 'Matriz de Kraljic — Visualização';
  matriz.getCell('A1').font = { bold: true, size: 14 };
  matriz.getCell('A1').alignment = { horizontal: 'left' };
  matriz.getRow(1).height = 24;

  if (opts.chartPng) {
    const chartId = wb.addImage({
      buffer: opts.chartPng as unknown as ArrayBuffer,
      extension: 'png',
    });
    matriz.addImage(chartId, {
      tl: { col: 0, row: 2 },
      ext: { width: 720, height: 480 },
    });
  } else {
    matriz.getCell('A3').value = '(gráfico indisponível — render falhou)';
  }

  // ─── Sheet 3 — Itens ─────────────────────────────────────────────────
  const itens = wb.addWorksheet('Itens');
  const itensCols = [
    { header: 'Segmento', key: 'segment', width: 18 },
    { header: 'Categoria', key: 'category', width: 22 },
    { header: 'Item', key: 'name', width: 30 },
    { header: 'Spend (R$ MM)', key: 'spendMM', width: 16 },
    { header: '% Spend', key: 'spendShare', width: 12 },
    { header: 'Spend (1-4)', key: 'spendScore', width: 12 },
    { header: 'Criticidade (1-4)', key: 'criticality', width: 14 },
    { header: 'Esp. Técnicas (1-4)', key: 'technicalSpec', width: 16 },
    { header: 'Valor Cliente (1-4)', key: 'customerValue', width: 16 },
    { header: 'Estrutura (1-4)', key: 'marketStructure', width: 14 },
    { header: 'Rivalidade (1-4)', key: 'marketRivalry', width: 14 },
    { header: 'Poder Forn. (1-4)', key: 'supplierPower', width: 14 },
    { header: 'Substituição (1-4)', key: 'supplierSwitching', width: 14 },
    { header: 'Impacto', key: 'businessImpact', width: 12 },
    { header: 'Complexidade', key: 'supplyComplexity', width: 14 },
    { header: 'Quadrante', key: 'quadrant', width: 16 },
  ];
  itens.columns = itensCols;
  const itensHeader = itens.getRow(1);
  styleHeader(itensHeader);

  for (const it of classified) {
    const row = itens.addRow({
      segment: it.segment,
      category: it.category,
      name: it.name,
      spendMM: Number(it.spendMM.toFixed(2)),
      spendShare: Number((it.spendShare * 100).toFixed(1)),
      spendScore: it.spendScore,
      criticality: it.criticality,
      technicalSpec: it.technicalSpec,
      customerValue: it.customerValue,
      marketStructure: it.marketStructure,
      marketRivalry: it.marketRivalry,
      supplierPower: it.supplierPower,
      supplierSwitching: it.supplierSwitching,
      businessImpact: it.businessImpact,
      supplyComplexity: it.supplyComplexity,
      quadrant: KRALJIC_QUADRANT_LABELS[it.quadrant],
    });
    row.eachCell({ includeEmpty: true }, thinBorders);
  }
  itens.views = [{ state: 'frozen', ySplit: 1 }];

  // ─── Sheet 4 — Plano de Ação ─────────────────────────────────────────
  const acao = wb.addWorksheet('Plano de Ação');
  acao.columns = [
    { header: 'Item', key: 'name', width: 32 },
    { header: 'Quadrante', key: 'quadrant', width: 16 },
    { header: 'Spend (R$ MM)', key: 'spendMM', width: 16 },
    { header: 'Recomendação chave', key: 'rec', width: 80 },
  ];
  styleHeader(acao.getRow(1));

  // Priorize Estratégico e Gargalo na ação. Outros entram com hint genérico.
  const priorityOrder: Record<string, number> = {
    estrategico: 1, gargalo: 2, alavancavel: 3, 'nao-critico': 4,
  };
  const recommendations: Record<string, string> = {
    estrategico:
      'Parceria de longo prazo (3+ anos) com governança ativa (QBR trimestral). Co-desenvolvimento e plano de mitigação de fornecedor único.',
    alavancavel:
      'RFQ competitivo / leilão reverso anual. Consolidar volume com 2-3 fornecedores. Avaliar e-procurement / contrato guarda-chuva.',
    gargalo:
      'Garantir continuidade: estoque de segurança, contrato com penalidade de SLA, desenvolvimento de fornecedor alternativo.',
    'nao-critico':
      'Simplificar P2P: catálogo, pCard, automação. Evitar atenção gerencial — comprar com menor custo administrativo.',
  };

  const sorted = [...classified].sort(
    (a, b) =>
      (priorityOrder[a.quadrant] ?? 99) - (priorityOrder[b.quadrant] ?? 99) ||
      b.spendMM - a.spendMM,
  );
  for (const it of sorted) {
    const row = acao.addRow({
      name: it.name,
      quadrant: KRALJIC_QUADRANT_LABELS[it.quadrant],
      spendMM: Number(it.spendMM.toFixed(2)),
      rec: recommendations[it.quadrant] ?? '',
    });
    row.eachCell({ includeEmpty: true }, thinBorders);
    row.getCell('rec').alignment = { wrapText: true };
  }
  acao.views = [{ state: 'frozen', ySplit: 1 }];

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}
