import ExcelJS from 'exceljs';
import type { ScorecardParams, ClassifiedSupplier } from './types';
import { SCORECARD_BAND_LABELS } from './types';
import type { XlsxLogo } from './xlsx';

// Sub-projeto 5 (Scorecard) — Multi-sheet Supplier Scorecard workbook.
//
// 3 sheets (chart sheet is conditional):
//   1. Scorecard  — all criteria scores per supplier + weighted score + rank + band
//   2. Ranking    — sorted by rank with Recomendação per band
//   3. Gráfico    — (optional) embedded chart PNG

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

const BAND_RECOMMENDATION: Record<string, string> = {
  estrategico: 'Desenvolver parceria / QBR',
  desenvolvimento: 'Plano de melhoria com metas',
  saida: 'Dual-sourcing / substituição',
};

export async function buildScorecardXlsxBuffer(
  params: ScorecardParams,
  classified: ClassifiedSupplier[],
  opts: { logo?: XlsxLogo; chartPng?: Buffer } = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PROGPT';
  wb.created = new Date();

  // ─── Sheet 1 — Scorecard ─────────────────────────────────────────────────
  const scorecard = wb.addWorksheet('Scorecard', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  // Optional title row with scorecard name
  if (params.scorecardName) {
    const titleRow = scorecard.addRow([params.scorecardName]);
    const totalCols = 3 + params.criteria.length; // name + criteria + score + rank + band
    scorecard.mergeCells(1, 1, 1, totalCols);
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    titleRow.height = 28;
  }

  // Header row: Fornecedor | Criteria (label + weight%) | Score | Rank | Faixa
  const criteriaHeaders = params.criteria.map(
    (c) => `${c.label} (${c.weight}%)`,
  );
  const headerValues = ['Fornecedor', ...criteriaHeaders, 'Score', 'Rank', 'Faixa'];
  const headerRow = scorecard.addRow(headerValues);
  styleHeader(headerRow);

  // Column widths
  scorecard.getColumn(1).width = 28; // Fornecedor
  params.criteria.forEach((_, idx) => {
    scorecard.getColumn(2 + idx).width = 18; // criteria columns
  });
  const scoreCol = 2 + params.criteria.length;
  scorecard.getColumn(scoreCol).width = 10;     // Score
  scorecard.getColumn(scoreCol + 1).width = 8;  // Rank
  scorecard.getColumn(scoreCol + 2).width = 22; // Faixa

  // Data rows
  for (const s of classified) {
    const criteriaScores = params.criteria.map((c) => s.scores[c.id] ?? 0);
    const rowData = [
      s.name,
      ...criteriaScores,
      s.weightedScore,
      s.rank,
      SCORECARD_BAND_LABELS[s.band],
    ];
    const row = scorecard.addRow(rowData);
    row.eachCell({ includeEmpty: true }, thinBorders);
  }

  scorecard.views = [{ state: 'frozen', ySplit: params.scorecardName ? 2 : 1 }];

  // ─── Sheet 2 — Ranking ───────────────────────────────────────────────────
  const ranking = wb.addWorksheet('Ranking', {
    pageSetup: { paperSize: 9, orientation: 'portrait' },
  });

  ranking.columns = [
    { key: 'rank', width: 8 },
    { key: 'name', width: 28 },
    { key: 'segment', width: 20 },
    { key: 'score', width: 10 },
    { key: 'band', width: 22 },
    { key: 'rec', width: 42 },
  ];

  const rankHeader = ranking.addRow(['Rank', 'Fornecedor', 'Segmento', 'Score', 'Faixa', 'Recomendação']);
  styleHeader(rankHeader);

  // classified is already sorted by rank asc (scoreSuppliers outputs rank-ordered)
  for (const s of classified) {
    const row = ranking.addRow({
      rank: s.rank,
      name: s.name,
      segment: s.segment || '—',
      score: s.weightedScore,
      band: SCORECARD_BAND_LABELS[s.band],
      rec: BAND_RECOMMENDATION[s.band] ?? '',
    });
    row.eachCell({ includeEmpty: true }, thinBorders);
    row.getCell('rec').alignment = { wrapText: true };
  }

  ranking.views = [{ state: 'frozen', ySplit: 1 }];

  // ─── Sheet 3 — Gráfico (optional) ────────────────────────────────────────
  if (opts.chartPng) {
    const grafico = wb.addWorksheet('Gráfico', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });
    grafico.mergeCells('A1:J1');
    grafico.getCell('A1').value = `Ranking de fornecedores — ${params.scorecardName}`;
    grafico.getCell('A1').font = { bold: true, size: 14 };
    grafico.getCell('A1').alignment = { horizontal: 'left' };
    grafico.getRow(1).height = 24;

    const id = wb.addImage({
      buffer: opts.chartPng as unknown as ArrayBuffer,
      extension: 'png',
    });
    grafico.addImage(id, {
      tl: { col: 0, row: 1 },
      ext: { width: 680, height: 420 },
    });
  }

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}
