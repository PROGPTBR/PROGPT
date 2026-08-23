import ExcelJS from 'exceljs';
import type { NewSupplierInput } from './base';

// Import de "vendor list" (Batch L do backlog do diretor — Kraljic: "poderia
// subir o vendor list do cliente [e] ele puxasse da base interna facilitando
// com o preenchimento CNPJ, nome e outras informações"). Mesmo padrão de
// fuzzy-header matching de lib/spend/sheet-import.ts / lib/materials/import.ts.
//
// Planilha: linha 1 = cabeçalhos, linha 2+ = dados. `razaoSocial` é a única
// coluna obrigatória.

export type VendorListImportResult = {
  rows: NewSupplierInput[];
  warnings: string[];
};

type Field = 'razaoSocial' | 'cnpj' | 'categoria' | 'uf' | 'municipio' | 'telefone' | 'email';

const HEADER_ALIASES: Array<[Field, RegExp[]]> = [
  ['cnpj', [/\bcnpj\b/i]],
  ['uf', [/\buf\b/i, /\bestado\b/i]],
  ['municipio', [/\bmunic[íi]pio\b/i, /\bcidade\b/i, /\bcity\b/i]],
  ['telefone', [/\btelefone\b/i, /\bfone\b/i, /\btel\.?\b/i, /\bphone\b/i]],
  ['email', [/\be-?mail\b/i]],
  ['categoria', [/\bcategoria\b/i, /\bcategory\b/i, /\bsegmento\b/i]],
  // nome/razão social por último — genérico o bastante pra pegar "nome" sozinho.
  [
    'razaoSocial',
    [/raz[ãa]o\s*social/i, /\bfornecedor\b/i, /\bvendor\b/i, /\bsupplier\b/i, /\bempresa\b/i, /\bnome\b/i],
  ],
];

function matchHeader(text: string): Field | null {
  const t = text.trim();
  if (!t) return null;
  for (const [field, patterns] of HEADER_ALIASES) {
    if (patterns.some((p) => p.test(t))) return field;
  }
  return null;
}

function coerceString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const obj = value as { text?: unknown; result?: unknown };
    if (typeof obj.text === 'string') return obj.text.trim();
    if (obj.result !== undefined && obj.result !== null) return String(obj.result).trim();
    return '';
  }
  return String(value).trim();
}

export async function parseVendorListXlsx(buffer: Buffer): Promise<VendorListImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet('Fornecedores') ?? wb.worksheets[0];
  if (!ws) return { rows: [], warnings: ['Workbook sem planilhas.'] };

  const warnings: string[] = [];
  const headerRow = ws.getRow(1);
  const colMap: Partial<Record<Field, number>> = {};
  headerRow.eachCell((cell, colNumber) => {
    const k = matchHeader(coerceString(cell.value));
    if (k && !(k in colMap)) colMap[k] = colNumber;
  });

  if (colMap.razaoSocial === undefined) {
    warnings.push('Coluna obrigatória não detectada: razão social / nome / fornecedor.');
    return { rows: [], warnings };
  }

  const rows: NewSupplierInput[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const razaoSocial = coerceString(row.getCell(colMap.razaoSocial).value);
    if (!razaoSocial) continue;

    const str = (f: Field): string | null => {
      const col = colMap[f];
      if (!col) return null;
      const v = coerceString(row.getCell(col).value);
      return v.length > 0 ? v : null;
    };

    rows.push({
      razaoSocial,
      cnpj: str('cnpj')?.replace(/\D/g, '') || null,
      categoria: str('categoria'),
      uf: str('uf')?.toUpperCase().slice(0, 2) ?? null,
      municipio: str('municipio'),
      telefone: str('telefone'),
      email: str('email'),
    });
  }

  if (rows.length === 0) warnings.push('Nenhuma linha com razão social encontrada.');
  return { rows, warnings };
}
