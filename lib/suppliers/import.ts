import ExcelJS from 'exceljs';
import type { NewSupplierInput } from './base';

// Import de "vendor list" (Batch L do backlog do diretor — Kraljic: "poderia
// subir o vendor list do cliente [e] ele puxasse da base interna facilitando
// com o preenchimento CNPJ, nome e outras informações"). Mesmo padrão de
// fuzzy-header matching de lib/spend/sheet-import.ts / lib/materials/import.ts.
//
// Vendor list de cliente real NÃO segue modelo (achado 2026-10-05, Construtora
// Costa Feitosa): título mesclado no topo, cabeçalho na linha 3 ou 8, várias
// abas (controle de cotações, base de fornecedores, tabela dinâmica), cidade
// como "São Paulo - SP" e nenhuma coluna de CNPJ. A versão anterior lia só a
// primeira aba com cabeçalho na linha 1 e devolvia "coluna obrigatória não
// detectada". Agora:
//   - procura o cabeçalho nas primeiras linhas de CADA aba;
//   - escolhe a aba que mais parece uma base de fornecedores;
//   - separa "Cidade - UF";
//   - guarda contato e observações nas notas.
// `razaoSocial` continua sendo a única coluna obrigatória.

export type VendorListImportResult = {
  rows: NewSupplierInput[];
  warnings: string[];
};

type Field =
  | 'razaoSocial'
  | 'cnpj'
  | 'categoria'
  | 'uf'
  | 'municipio'
  | 'telefone'
  | 'email'
  | 'contato'
  | 'observacoes';

// A ORDEM importa: o primeiro padrão que casar decide a coluna. "Contato" e
// "observações" vêm antes do nome do fornecedor porque "nome do contato"
// também casaria com /nome/.
const HEADER_ALIASES: Array<[Field, RegExp[]]> = [
  ['cnpj', [/\bcnpj\b/i, /\bcpf\s*\/\s*cnpj\b/i]],
  ['uf', [/^\s*uf\s*$/i, /\bestado\b/i]],
  ['municipio', [/\bmunic[íi]pio\b/i, /\bcidade\b/i, /\bcity\b/i, /\blocalidade\b/i]],
  ['telefone', [/\btelefone\b/i, /\bfone\b/i, /\btel\.?\b/i, /\bphone\b/i, /\bcelular\b/i, /\bwhats/i]],
  ['email', [/\be-?mail\b/i]],
  ['contato', [/\bcontato\b/i, /\brespons[áa]vel\b/i, /\bvendedor\b/i, /\brepresentante\b/i]],
  ['observacoes', [/\bobserva[çc][õo]es\b/i, /\bobs\.?\b/i, /\bnotas?\b/i]],
  [
    'categoria',
    [/\bcategoria\b/i, /\bcategory\b/i, /\bsegmento\b/i, /\bgrupo\b/i, /\bmateriais\b/i, /\bfam[íi]lia\b/i],
  ],
  // nome/razão social por último — genérico o bastante pra pegar "nome" sozinho.
  [
    'razaoSocial',
    [/raz[ãa]o\s*social/i, /\bfornecedor/i, /\bvendor\b/i, /\bsupplier\b/i, /\bempresa\b/i, /\bnome\b/i],
  ],
];

/** Linhas do topo de cada aba onde o cabeçalho pode estar (títulos, logos, datas acima). */
const LINHAS_PARA_PROCURAR_CABECALHO = 30;

/** Valores que planilhas dinâmicas e formulários usam para "vazio". */
const VAZIOS = new Set(['', '(vazio)', '-', '--', 'n/a', 'na', 'null']);

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
    const obj = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: string }> };
    if (typeof obj.text === 'string') return obj.text.trim();
    if (Array.isArray(obj.richText)) return obj.richText.map((t) => t.text ?? '').join('').trim();
    if (obj.result !== undefined && obj.result !== null) return String(obj.result).trim();
    return '';
  }
  return String(value).trim();
}

function limpo(v: string): string | null {
  const t = v.replace(/\s+/g, ' ').trim();
  return VAZIOS.has(t.toLowerCase()) ? null : t;
}

type Cabecalho = { linha: number; colunas: Partial<Record<Field, number>> };

/** Acha a linha de cabeçalho de uma aba: a que tem a coluna do fornecedor e mais colunas reconhecidas. */
function acharCabecalho(ws: ExcelJS.Worksheet): Cabecalho | null {
  let melhor: Cabecalho | null = null;
  let melhorQtd = 0;
  // Planilha só com a coluna do nome também vale — mas só se nenhuma linha
  // tiver nome + outra coluna, porque um título como "FORNECEDORES -
  // CONSTRUTORA" casa sozinho e não é cabeçalho.
  let soNome: Cabecalho | null = null;
  const ate = Math.min(ws.rowCount, LINHAS_PARA_PROCURAR_CABECALHO);
  for (let r = 1; r <= ate; r++) {
    const colunas: Partial<Record<Field, number>> = {};
    ws.getRow(r).eachCell((cell, colNumber) => {
      const k = matchHeader(coerceString(cell.value));
      if (k && !(k in colunas)) colunas[k] = colNumber;
    });
    const qtd = Object.keys(colunas).length;
    if (colunas.razaoSocial === undefined) continue;
    if (qtd >= 2 && qtd > melhorQtd) {
      melhor = { linha: r, colunas };
      melhorQtd = qtd;
    } else if (qtd === 1 && !soNome) {
      soNome = { linha: r, colunas };
    }
  }
  return melhor ?? soNome;
}

/** "São Paulo - SP", "Recife/PE", "Natal (RN)" → cidade + UF. */
export function separarCidadeUf(texto: string): { municipio: string | null; uf: string | null } {
  const t = texto.replace(/\s+/g, ' ').trim();
  // Só a sigla na coluna de cidade ("SP"): é UF, não cidade.
  if (/^[A-Za-z]{2}$/.test(t)) return { municipio: null, uf: t.toUpperCase() };
  const m = /^(.+?)\s*(?:[-–/]|\()\s*([A-Za-z]{2})\)?(?:\b.*)?$/.exec(t);
  if (m && m[1] && m[2]) return { municipio: m[1].trim(), uf: m[2].toUpperCase() };
  return { municipio: t, uf: null };
}

function linhasDaAba(ws: ExcelJS.Worksheet, cab: Cabecalho): NewSupplierInput[] {
  const { colunas } = cab;
  const rows: NewSupplierInput[] = [];
  for (let r = cab.linha + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const str = (f: Field): string | null => {
      const col = colunas[f];
      if (!col) return null;
      return limpo(coerceString(row.getCell(col).value));
    };

    const razaoSocial = str('razaoSocial');
    if (!razaoSocial) continue;
    // Cabeçalho repetido no meio da planilha (impressão em páginas).
    if (matchHeader(razaoSocial) === 'razaoSocial' && str('email') && matchHeader(str('email')!) === 'email') continue;

    let municipio = str('municipio');
    let uf = str('uf')?.toUpperCase().slice(0, 2) ?? null;
    if (municipio && !uf) {
      const sep = separarCidadeUf(municipio);
      municipio = sep.municipio;
      uf = sep.uf;
    }

    const contato = str('contato');
    const obs = str('observacoes');
    const notas = [contato ? `Contato: ${contato}` : null, obs].filter(Boolean).join(' · ') || null;

    rows.push({
      razaoSocial,
      cnpj: str('cnpj')?.replace(/\D/g, '') || null,
      categoria: str('categoria'),
      uf,
      municipio,
      telefone: str('telefone'),
      email: str('email')?.toLowerCase() ?? null,
      notas,
    });
  }
  return rows;
}

export async function parseVendorListXlsx(buffer: Buffer): Promise<VendorListImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  if (wb.worksheets.length === 0) return { rows: [], warnings: ['Workbook sem planilhas.'] };

  // Avalia todas as abas e fica com a que mais parece uma base de fornecedores:
  // mais colunas reconhecidas e, no empate, mais linhas de dados. Aba com
  // "fornecedor" no nome ganha um empurrão.
  type Candidata = { ws: ExcelJS.Worksheet; cab: Cabecalho; rows: NewSupplierInput[]; pontos: number };
  const candidatas: Candidata[] = [];
  for (const ws of wb.worksheets) {
    const cab = acharCabecalho(ws);
    if (!cab) continue;
    const rows = linhasDaAba(ws, cab);
    if (rows.length === 0) continue;
    const pontos =
      Object.keys(cab.colunas).length * 1_000 +
      (/fornecedor|vendor|supplier/i.test(ws.name) ? 500 : 0) +
      Math.min(rows.length, 499);
    candidatas.push({ ws, cab, rows, pontos });
  }

  if (candidatas.length === 0) {
    return {
      rows: [],
      warnings: [
        'Não encontrei uma tabela de fornecedores: preciso de uma coluna com o nome (fornecedor, razão social ou empresa) e pelo menos mais uma coluna, como e-mail, telefone ou cidade.',
      ],
    };
  }

  candidatas.sort((a, b) => b.pontos - a.pontos);
  const escolhida = candidatas[0]!;
  const warnings: string[] = [];
  if (wb.worksheets.length > 1) {
    warnings.push(`Li a aba "${escolhida.ws.name}" (cabeçalho na linha ${escolhida.cab.linha}).`);
  }
  if (escolhida.cab.colunas.cnpj === undefined) {
    warnings.push('A planilha não tem coluna de CNPJ: os fornecedores entram sem CNPJ e são reconhecidos pelo nome e e-mail numa próxima importação.');
  }
  return { rows: escolhida.rows, warnings };
}
