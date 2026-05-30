// scripts/build_scorecard_template_xlsx.js
// Generates public/templates/scorecard-template.xlsx
//
// Sheet layout mirrors parseScorecardXlsx expectations:
//   Row 1: headers — col 1 = 'Fornecedor', cols 2..n = criterion labels
//   Row 2+: data   — col 1 = supplier name, cols 2..n = scores 0–10
//
// Criterion labels match DEFAULT_SCORECARD_CRITERIA in lib/assistants/types.ts.
// Run with: node scripts/build_scorecard_template_xlsx.js

'use strict';

const ExcelJS = require('exceljs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'templates', 'scorecard-template.xlsx');

const HEADERS = [
  'Fornecedor',
  'Qualidade',
  'Prazo de entrega',
  'Preço/competitividade',
  'Atendimento/relacionamento',
  'Inovação',
  'ESG/sustentabilidade',
];

const EXAMPLE_ROWS = [
  ['Fornecedor Exemplo A', 8, 7, 6, 9, 5, 7],
  ['Fornecedor Exemplo B', 6, 8, 9, 5, 4, 6],
];

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PROGPT';
  wb.created = new Date();

  const ws = wb.addWorksheet('Scorecard');

  // Header row — bold
  const headerRow = ws.addRow(HEADERS);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
  });

  // Data rows
  for (const row of EXAMPLE_ROWS) {
    ws.addRow(row);
  }

  // Auto-size columns (rough approximation)
  ws.columns.forEach((col, i) => {
    let maxLen = String(HEADERS[i] ?? '').length;
    for (const row of EXAMPLE_ROWS) {
      const v = String(row[i] ?? '');
      if (v.length > maxLen) maxLen = v.length;
    }
    col.width = Math.max(maxLen + 2, 12);
  });

  await wb.xlsx.writeFile(OUTPUT_PATH);
  console.log('Written:', OUTPUT_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
