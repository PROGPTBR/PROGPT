import ExcelJS from 'exceljs';
import { coerceAmount } from '@/lib/spend/sheet-import';
import type { NewMaterialInput } from './base';

// Import de planilha de materiais (Batch L do backlog do diretor —
// "precisa carregar o banco de dados de materiais do cliente"). Mesmo
// padrão de fuzzy-header matching de lib/spend/sheet-import.ts (não
// reescrito — `coerceAmount` é importado direto de lá pra pt-BR/en-US
// number coercion); a tabela de aliases aqui é específica de materiais.
//
// Planilha: linha 1 = cabeçalhos, linha 2+ = dados. `descricao` é a única
// coluna obrigatória (linha sem descrição é descartada).

export type MaterialImportResult = {
  rows: NewMaterialInput[];
  warnings: string[];
};

type Field =
  | 'codigo'
  | 'descricao'
  | 'categoria'
  | 'unidade'
  | 'ncm'
  | 'fornecedorPadraoCnpj'
  | 'precoUltimo'
  | 'moeda';

const HEADER_ALIASES: Array<[Field, RegExp[]]> = [
  ['codigo', [/\bc[oó]digo\b/i, /\bsku\b/i, /\bcod\.?\s*(item|material)?\b/i, /\bpart\s*number\b/i]],
  ['ncm', [/\bncm\b/i]],
  ['unidade', [/\bunidade\b/i, /\bun\.?\b/i, /\bunit\b/i, /\bum\b/i]],
  ['categoria', [/\bcategoria\b/i, /\bcategory\b/i, /\bclasse\b/i, /\bfam[ií]lia\b/i]],
  ['fornecedorPadraoCnpj', [/\bcnpj\b/i, /fornecedor.*cnpj/i, /cnpj.*fornecedor/i]],
  ['moeda', [/\bmoeda\b/i, /\bcurrency\b/i, /\bccy\b/i]],
  ['precoUltimo', [/\bpre[çc]o\b/i, /\bvalor\b/i, /\bcusto\b/i, /\bprice\b/i]],
  // description por último — é o "pega-tudo" mais genérico (item/material).
  ['descricao', [/descri[çc][ãa]o/i, /\bitem\b/i, /\bmaterial\b/i, /\bproduto\b/i, /\bdescription\b/i]],
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

export async function parseMaterialsXlsx(buffer: Buffer): Promise<MaterialImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet('Materiais') ?? wb.worksheets[0];
  if (!ws) return { rows: [], warnings: ['Workbook sem planilhas.'] };

  const warnings: string[] = [];
  const headerRow = ws.getRow(1);
  const colMap: Partial<Record<Field, number>> = {};
  headerRow.eachCell((cell, colNumber) => {
    const k = matchHeader(coerceString(cell.value));
    if (k && !(k in colMap)) colMap[k] = colNumber;
  });

  if (colMap.descricao === undefined) {
    warnings.push('Coluna obrigatória não detectada: descrição / item / material.');
    return { rows: [], warnings };
  }

  const rows: NewMaterialInput[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const descricao = coerceString(row.getCell(colMap.descricao).value);
    if (!descricao) continue; // linha vazia/sem descrição — pula

    const str = (f: Field): string | null => {
      const col = colMap[f];
      if (!col) return null;
      const v = coerceString(row.getCell(col).value);
      return v.length > 0 ? v : null;
    };

    rows.push({
      codigo: str('codigo'),
      descricao,
      categoria: str('categoria'),
      unidade: str('unidade'),
      ncm: str('ncm')?.replace(/\D/g, '') || null,
      fornecedorPadraoCnpj: str('fornecedorPadraoCnpj')?.replace(/\D/g, '') || null,
      precoUltimo: colMap.precoUltimo ? coerceAmount(row.getCell(colMap.precoUltimo).value) : null,
      moeda: str('moeda')?.toUpperCase() ?? null,
    });
  }

  if (rows.length === 0) warnings.push('Nenhuma linha com descrição encontrada.');
  return { rows, warnings };
}
