import ExcelJS from 'exceljs';
import type { KraljicItem } from './types';
import { KraljicItemSchema } from './types';

// Sub-projeto 27 — Parse an uploaded .xlsx into a KraljicItem[].
//
// Two parsing strategies:
//   1. **Procurement Garage layout** — first worksheet is the "DADOS" sheet
//      of the PG template; header is on rows 6-7, data starts at row 9,
//      column positions match the template exactly.
//   2. **Generic header-match** — first sheet's first row is read as
//      headers; columns are mapped by fuzzy name matching ("spend",
//      "criticidade", "estrutura", etc.).
//
// Both produce an array of items + warnings for rows that failed
// validation. The route returns both so the UI can show "we parsed
// 18 / 23 items; 5 had problems".

export type ImportResult = {
  items: KraljicItem[];
  warnings: string[];
};

// Header keyword → KraljicItem key. Order = priority of matching.
const HEADER_MAP: { key: keyof KraljicItem; keywords: string[] }[] = [
  { key: 'segment', keywords: ['segmento'] },
  { key: 'category', keywords: ['categoria'] },
  { key: 'name', keywords: ['rotulo', 'rótulo', 'item', 'nome'] },
  { key: 'spendMM', keywords: ['spend'] },
  { key: 'criticality', keywords: ['criticidade'] },
  { key: 'technicalSpec', keywords: ['especificacao', 'especificação', 'técnica', 'tecnica'] },
  { key: 'customerValue', keywords: ['valor percebido', 'cliente'] },
  { key: 'marketStructure', keywords: ['estrutura'] },
  { key: 'marketRivalry', keywords: ['rivalidade'] },
  { key: 'supplierPower', keywords: ['poder', 'barganha'] },
  { key: 'supplierSwitching', keywords: ['substituicao', 'substituição', 'switching'] },
];

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function matchHeader(header: string): keyof KraljicItem | null {
  const h = normalize(header);
  for (const { key, keywords } of HEADER_MAP) {
    if (keywords.some((kw) => h.includes(normalize(kw)))) return key;
  }
  return null;
}

function coerceNumber(v: unknown, fallback = 1): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.,-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function looksLikePgDadosSheet(ws: ExcelJS.Worksheet): boolean {
  // PG template: row 2 col F = "MATRIZ DE KRALJIC ...", row 6 col 1 = "SEGMENTO"
  const a1 = String(ws.getRow(2).getCell(6).value ?? '').toUpperCase();
  const a6 = String(ws.getRow(6).getCell(1).value ?? '').toUpperCase();
  return a1.includes('MATRIZ DE KRALJIC') && a6.includes('SEGMENTO');
}

function parsePgDados(ws: ExcelJS.Worksheet): ImportResult {
  // Fixed column positions per the PG template:
  //  1=Segmento, 2=Categoria, 3=Rótulo, 4=Spend (R$ MM), 5=% (computed),
  //  6=Spend score, 7=Criticidade, 8=Esp. técnicas, 9=Valor cliente,
  //  10=Pontuação impacto (computed),
  //  12=Estrutura, 13=Rivalidade, 14=Poder Barganha, 15=Substituição
  const items: KraljicItem[] = [];
  const warnings: string[] = [];

  for (let r = 9; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = String(row.getCell(3).value ?? '').trim();
    if (!name) continue; // empty row
    const candidate = {
      name,
      segment: String(row.getCell(1).value ?? '').trim(),
      category: String(row.getCell(2).value ?? '').trim(),
      spendMM: coerceNumber(row.getCell(4).value, 0),
      criticality: coerceNumber(row.getCell(7).value, 1),
      technicalSpec: coerceNumber(row.getCell(8).value, 1),
      customerValue: coerceNumber(row.getCell(9).value, 1),
      marketStructure: coerceNumber(row.getCell(12).value, 1),
      marketRivalry: coerceNumber(row.getCell(13).value, 1),
      supplierPower: coerceNumber(row.getCell(14).value, 1),
      supplierSwitching: coerceNumber(row.getCell(15).value, 1),
    };
    const parsed = KraljicItemSchema.safeParse(candidate);
    if (parsed.success) {
      items.push(parsed.data);
    } else {
      warnings.push(`Linha ${r} (${name}): ${parsed.error.issues[0]?.message ?? 'inválido'}`);
    }
  }
  return { items, warnings };
}

function parseGenericByHeader(ws: ExcelJS.Worksheet): ImportResult {
  const items: KraljicItem[] = [];
  const warnings: string[] = [];

  const headerRow = ws.getRow(1);
  const colMap: Partial<Record<keyof KraljicItem, number>> = {};
  headerRow.eachCell((cell, colNumber) => {
    const txt = String(cell.value ?? '');
    const k = matchHeader(txt);
    if (k && !(k in colMap)) colMap[k] = colNumber;
  });

  const required: (keyof KraljicItem)[] = [
    'name', 'spendMM', 'criticality', 'technicalSpec', 'customerValue',
    'marketStructure', 'marketRivalry', 'supplierPower', 'supplierSwitching',
  ];
  const missing = required.filter((k) => !(k in colMap));
  if (missing.length > 0) {
    warnings.push(`Colunas não detectadas: ${missing.join(', ')}`);
    return { items, warnings };
  }

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = String(row.getCell(colMap.name!).value ?? '').trim();
    if (!name) continue;
    const candidate = {
      name,
      segment: colMap.segment ? String(row.getCell(colMap.segment).value ?? '').trim() : '',
      category: colMap.category ? String(row.getCell(colMap.category).value ?? '').trim() : '',
      spendMM: coerceNumber(row.getCell(colMap.spendMM!).value, 0),
      criticality: coerceNumber(row.getCell(colMap.criticality!).value, 1),
      technicalSpec: coerceNumber(row.getCell(colMap.technicalSpec!).value, 1),
      customerValue: coerceNumber(row.getCell(colMap.customerValue!).value, 1),
      marketStructure: coerceNumber(row.getCell(colMap.marketStructure!).value, 1),
      marketRivalry: coerceNumber(row.getCell(colMap.marketRivalry!).value, 1),
      supplierPower: coerceNumber(row.getCell(colMap.supplierPower!).value, 1),
      supplierSwitching: coerceNumber(row.getCell(colMap.supplierSwitching!).value, 1),
    };
    const parsed = KraljicItemSchema.safeParse(candidate);
    if (parsed.success) items.push(parsed.data);
    else warnings.push(`Linha ${r} (${name}): ${parsed.error.issues[0]?.message ?? 'inválido'}`);
  }
  return { items, warnings };
}

export async function parseImportedItems(buffer: Buffer): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  // Prefer the "DADOS" sheet from the PG template; else first sheet.
  const dados = wb.getWorksheet('DADOS');
  const ws = dados ?? wb.worksheets[0];
  if (!ws) {
    return { items: [], warnings: ['Workbook sem planilhas'] };
  }
  if (dados && looksLikePgDadosSheet(dados)) {
    return parsePgDados(dados);
  }
  return parseGenericByHeader(ws);
}
