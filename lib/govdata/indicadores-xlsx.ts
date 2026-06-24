import ExcelJS from 'exceljs';
import type { PontoSerie } from './indicadores';

// Export .xlsx de uma série histórica de indicador (sub-projeto 37 — dashboard).
// Workbook simples: cabeçalho com o indicador + tabela Data/Valor. `creator`
// 'PROGPT' como nos demais exports.

export async function serieXlsxBuffer(
  nome: string,
  unidade: string,
  pontos: PontoSerie[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PROGPT';
  wb.created = new Date(0); // determinístico (evita Date.now no build/test)

  const ws = wb.addWorksheet('Série', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });
  ws.getColumn(1).width = 16;
  ws.getColumn(2).width = 18;

  // Banner
  ws.mergeCells('A1:B1');
  const title = ws.getCell('A1');
  title.value = `${nome} (${unidade})`;
  title.font = { bold: true, size: 13 };
  ws.mergeCells('A2:B2');
  const sub = ws.getCell('A2');
  sub.value = 'Fonte: Banco Central do Brasil (séries SGS)';
  sub.font = { size: 9, italic: true, color: { argb: 'FF666666' } };

  // Header
  const header = ws.getRow(3);
  header.getCell(1).value = 'Data';
  header.getCell(2).value = `Valor (${unidade})`;
  header.font = { bold: true };
  header.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    c.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
  });

  // Rows
  pontos.forEach((p, i) => {
    const row = ws.getRow(4 + i);
    row.getCell(1).value = p.data;
    const cell = row.getCell(2);
    cell.value = p.valor;
    cell.numFmt = unidade === 'R$' ? 'R$ #,##0.0000' : '#,##0.00';
  });

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}
