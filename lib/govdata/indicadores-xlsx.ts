import ExcelJS from 'exceljs';
import type { PontoSerie } from './indicadores';

// Export .xlsx de uma série histórica de indicador (sub-projeto 37 — dashboard).
// Workbook simples: cabeçalho com o indicador + tabela Data/Valor. `creator`
// 'PROGPT' como nos demais exports.
//
// Batch K (backlog do diretor 21/08) — banner ganha metodologia + data da
// consulta, além da fonte (o doc pede fonte/data/período/metodologia
// registrados junto do dado).

export interface SerieXlsxMeta {
  metodologia?: string;
  consultadoEm?: string; // ISO; formatado pt-BR no banner
}

export async function serieXlsxBuffer(
  nome: string,
  unidade: string,
  pontos: PontoSerie[],
  meta: SerieXlsxMeta = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PROGPT';
  wb.created = new Date(0); // determinístico (evita Date.now no build/test)

  const bannerRows = 2 + (meta.metodologia ? 1 : 0) + (meta.consultadoEm ? 1 : 0);
  const ws = wb.addWorksheet('Série', {
    views: [{ state: 'frozen', ySplit: bannerRows + 1 }],
  });
  ws.getColumn(1).width = 16;
  ws.getColumn(2).width = 18;

  // Banner
  ws.mergeCells('A1:B1');
  const title = ws.getCell('A1');
  title.value = `${nome} (${unidade})`;
  title.font = { bold: true, size: 13 };

  let bannerRow = 2;
  ws.mergeCells(`A${bannerRow}:B${bannerRow}`);
  const sub = ws.getCell(`A${bannerRow}`);
  sub.value = 'Fonte: Banco Central do Brasil (séries SGS)';
  sub.font = { size: 9, italic: true, color: { argb: 'FF666666' } };
  bannerRow++;

  if (meta.metodologia) {
    ws.mergeCells(`A${bannerRow}:B${bannerRow}`);
    const m = ws.getCell(`A${bannerRow}`);
    m.value = `Metodologia: ${meta.metodologia}`;
    m.font = { size: 9, italic: true, color: { argb: 'FF666666' } };
    bannerRow++;
  }

  if (meta.consultadoEm) {
    ws.mergeCells(`A${bannerRow}:B${bannerRow}`);
    const d = ws.getCell(`A${bannerRow}`);
    const consultadoData = new Date(meta.consultadoEm);
    d.value = `Consultado em: ${
      Number.isNaN(consultadoData.getTime())
        ? meta.consultadoEm
        : consultadoData.toLocaleString('pt-BR')
    }`;
    d.font = { size: 9, italic: true, color: { argb: 'FF666666' } };
    bannerRow++;
  }

  // Header
  const header = ws.getRow(bannerRow);
  header.getCell(1).value = 'Data';
  header.getCell(2).value = `Valor (${unidade})`;
  header.font = { bold: true };
  header.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    c.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
  });

  // Rows
  pontos.forEach((p, i) => {
    const row = ws.getRow(bannerRow + 1 + i);
    row.getCell(1).value = p.data;
    const cell = row.getCell(2);
    cell.value = p.valor;
    cell.numFmt = unidade === 'R$' ? 'R$ #,##0.0000' : '#,##0.00';
  });

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}
