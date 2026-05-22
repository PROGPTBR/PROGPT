import type { SupplierResult } from './types';

// CSV formatter pra exportar resultados de busca de fornecedores.
// BOM UTF-8 + separator `;` pra Excel BR não corromper acentos nem
// quebrar colunas em vírgulas dentro de campos.

const BOM = '﻿';
const SEP = ';';
const EOL = '\r\n';

const HEADERS: Array<[string, (r: SupplierResult) => string]> = [
  ['CNPJ', (r) => formatCnpj(r.cnpj)],
  ['Razão Social', (r) => r.razao_social],
  ['Nome Fantasia', (r) => r.nome_fantasia ?? ''],
  ['CNAE Primário', (r) => r.cnae_primario ?? ''],
  ['CNAEs Secundários', (r) => (r.cnaes_secundarios ?? []).join(' / ')],
  ['Porte', (r) => r.porte ?? ''],
  ['Capital Social (R$)', (r) => formatCapital(r.capital_social)],
  ['Faixa Funcionários', (r) => r.faixa_funcionarios ?? ''],
  ['UF', (r) => r.uf ?? ''],
  ['Município', (r) => r.municipio ?? ''],
  ['Telefone', (r) => r.telefone ?? ''],
  ['Email', (r) => r.email ?? ''],
  ['Última Atualização RF', (r) => r.ultima_atualizacao_rf ?? ''],
];

export function suppliersToCsv(rows: SupplierResult[]): string {
  const header = HEADERS.map(([h]) => csvEscape(h)).join(SEP);
  const body = rows
    .map((r) => HEADERS.map(([, f]) => csvEscape(f(r))).join(SEP))
    .join(EOL);
  return BOM + header + EOL + body + EOL;
}

function csvEscape(value: string): string {
  if (value === '' || value == null) return '';
  const needs = /[";\r\n]/.test(value);
  if (!needs) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

function formatCapital(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
