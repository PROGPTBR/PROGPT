import ExcelJS from 'exceljs';
import type { RfpParams } from './types';

export type XlsxLogo = { buffer: Buffer; mime: 'image/png' | 'image/jpeg' };

// Sub-projeto 21 — Cotação export to .xlsx.
//
// The RFQ template defines a 22-column quote table with Brazilian fiscal
// fields (PIS/COFINS/ICMS/IPI/NCM). When suppliers receive the RFP, they
// fill this table out — markdown is a poor fit because suppliers work in
// Excel. So we generate a companion .xlsx with the same 22 columns, fixed
// header, ample empty rows, and a top banner that identifies the RFP
// (buyer name, category, deadline).
//
// The column set is intentionally hard-coded here (not parsed from the
// markdown output) — the suppliers need a stable, byte-perfect schema
// regardless of what the LLM emits in the markdown.

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: '#', key: 'item', width: 5 },
  { header: 'Part Number', key: 'partNumber', width: 16 },
  { header: 'Fornecedor', key: 'supplier', width: 18 },
  { header: 'Descrição do Item', key: 'description', width: 40 },
  { header: 'NCM', key: 'ncm', width: 12 },
  { header: 'Local de Entrega', key: 'deliveryLocation', width: 18 },
  { header: 'Estado', key: 'state', width: 8 },
  { header: 'Regime da Empresa', key: 'taxRegime', width: 18 },
  { header: 'Modalidade de entrega (incoterm)', key: 'incoterm', width: 20 },
  { header: 'Unidade de medida', key: 'unit', width: 12 },
  { header: 'Quantidade', key: 'quantity', width: 12 },
  { header: 'Valor unitário com PIS, COFINS e ICMS SEM IPI', key: 'unitNoIpi', width: 22 },
  { header: 'Valor total com PIS, COFINS e ICMS SEM IPI', key: 'totalNoIpi', width: 22 },
  { header: 'Valor unitário com PIS, COFINS e ICMS COM IPI', key: 'unitWithIpi', width: 22 },
  { header: 'Valor total com PIS, COFINS e ICMS COM IPI', key: 'totalWithIpi', width: 22 },
  { header: 'PIS', key: 'pis', width: 10 },
  { header: 'COFINS', key: 'cofins', width: 10 },
  { header: 'ICMS', key: 'icms', width: 10 },
  { header: 'IPI', key: 'ipi', width: 10 },
  { header: 'Prazo de Pagamento', key: 'paymentTerm', width: 18 },
  { header: 'Prazo de Entrega', key: 'deliveryTerm', width: 16 },
  { header: 'Observações Gerais', key: 'notes', width: 30 },
];

// Number of empty rows pre-created so the supplier can fill items
// without inserting rows. Mirrors the original .xls (37 rows).
const EMPTY_ROWS = 37;

export async function buildCotacaoXlsxBuffer(
  params: RfpParams,
  opts: { logo?: XlsxLogo } = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PROGPT';
  wb.created = new Date();
  const ws = wb.addWorksheet('Cotação', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  // Row 1 — banner. If logo present, place it on the left and push the
  // text banner right; otherwise text takes the whole left block.
  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = opts.logo ? '' : `RFQ — ${params.category}`;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };

  if (opts.logo) {
    const imageId = wb.addImage({
      buffer: opts.logo.buffer as unknown as ArrayBuffer,
      extension: opts.logo.mime === 'image/png' ? 'png' : 'jpeg',
    });
    // Anchor inside the merged A1:F1 block (row 1).
    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 160, height: 32 },
    });
  }

  ws.mergeCells('G1:L1');
  ws.getCell('G1').value = `Comprador: ${params.client}`;
  ws.getCell('G1').font = { bold: true };

  ws.mergeCells('M1:V1');
  ws.getCell('M1').value = `Prazo de resposta: ${params.deadline}`;
  ws.getCell('M1').font = { bold: true };

  ws.getRow(1).height = 22;

  // Row 2 — scope/notes
  ws.mergeCells('A2:V2');
  ws.getCell('A2').value = `Escopo: ${params.scope}`;
  ws.getCell('A2').alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(2).height = 30;

  // Row 3 — empty separator
  ws.addRow([]);

  // Row 4 — column headers
  const headerRow = ws.addRow(COLUMNS.map((c) => c.header));
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  headerRow.height = 48;

  // Apply column widths (already configured)
  COLUMNS.forEach((c, idx) => {
    ws.getColumn(idx + 1).width = c.width;
  });

  // Empty data rows, item index pre-filled
  for (let i = 1; i <= EMPTY_ROWS; i++) {
    const row = ws.addRow([i, '', '', '', '', '', '', '', '', '', '', 0, 0, 0, 0]);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= COLUMNS.length) {
        cell.border = {
          top: { style: 'hair', color: { argb: 'FFCCCCCC' } },
          left: { style: 'hair', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
          right: { style: 'hair', color: { argb: 'FFCCCCCC' } },
        };
      }
    });
  }

  // Freeze header
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}
