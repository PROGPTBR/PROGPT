// Tipos + rótulos da base de fornecedores (vendor master do comprador).
// Puro (sem DB/DOM) pra ser usado na UI e testado isolado.

export const SUPPLIER_STATUSES = [
  'prospecto',
  'em_homologacao',
  'homologado',
  'ativo',
  'bloqueado',
  'descartado',
] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const SUPPLIER_STATUS_LABEL: Record<SupplierStatus, string> = {
  prospecto: 'Prospecto',
  em_homologacao: 'Em homologação',
  homologado: 'Homologado',
  ativo: 'Ativo',
  bloqueado: 'Bloqueado',
  descartado: 'Descartado',
};

// Classes de badge por status (tema claro/escuro via tokens semânticos onde dá;
// cores fixas só nos selos saturados, como manda o design system).
export const SUPPLIER_STATUS_STYLE: Record<SupplierStatus, string> = {
  prospecto: 'bg-muted/60 border-border text-muted-foreground',
  em_homologacao:
    'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
  homologado:
    'bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400',
  ativo:
    'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
  bloqueado: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
  descartado: 'bg-muted/40 border-border text-muted-foreground line-through',
};

export function isSupplierStatus(v: unknown): v is SupplierStatus {
  return (
    typeof v === 'string' &&
    (SUPPLIER_STATUSES as readonly string[]).includes(v)
  );
}

export type SupplierOrigem = 'busca' | 'manual' | 'homologacao';

export type SavedSupplier = {
  id: string;
  cnpj: string | null;
  cnpjBasico: string | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnae: string | null;
  cnaeName: string | null;
  uf: string | null;
  municipio: string | null;
  telefone: string | null;
  email: string | null;
  categoria: string | null;
  status: SupplierStatus;
  rating: number | null;
  notas: string | null;
  origem: SupplierOrigem;
  createdAt: number;
  updatedAt: number;
};

// Campos que o usuário edita na base (o resto é derivado/imutável).
export type SupplierPatch = Partial<
  Pick<
    SavedSupplier,
    | 'razaoSocial'
    | 'nomeFantasia'
    | 'cnae'
    | 'cnaeName'
    | 'uf'
    | 'municipio'
    | 'telefone'
    | 'email'
    | 'categoria'
    | 'status'
    | 'rating'
    | 'notas'
  >
>;

export type NewSupplierInput = {
  razaoSocial: string;
  cnpj?: string | null;
  categoria?: string | null;
  uf?: string | null;
  municipio?: string | null;
  telefone?: string | null;
  email?: string | null;
  status?: SupplierStatus;
  notas?: string | null;
};

/** 8 primeiros dígitos do CNPJ (só dígitos), ou null. */
function normalizarTexto(v: string | null | undefined): string {
  return (v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, ' ')
    .trim();
}

/**
 * Chave para reconhecer o MESMO fornecedor numa nova importação. Com CNPJ, o
 * CNPJ base. Sem CNPJ (vendor list de muitos clientes não tem — achado
 * 2026-10-05, Costa Feitosa), o nome + o e-mail (ou telefone, ou cidade):
 * o mesmo fornecedor com dois contatos diferentes vira dois cadastros, de
 * propósito, e reimportar a mesma planilha atualiza em vez de duplicar.
 */
export function chaveFornecedor(f: {
  cnpj?: string | null;
  razaoSocial: string;
  email?: string | null;
  telefone?: string | null;
  municipio?: string | null;
}): string | null {
  const basico = cnpjBasicoOf(f.cnpj);
  if (basico) return `cnpj:${basico}`;
  const nome = normalizarTexto(f.razaoSocial);
  if (!nome) return null;
  const complemento =
    normalizarTexto(f.email) || (f.telefone ?? '').replace(/\D/g, '') || normalizarTexto(f.municipio);
  return `nome:${nome}|${complemento}`;
}

export function cnpjBasicoOf(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  const d = cnpj.replace(/\D/g, '');
  return d.length >= 8 ? d.slice(0, 8) : null;
}

// ─── Busca na base (2026-10-07) ────────────────────────────────────────────
// Pedido de cliente: "a busca está limitada, quero igual ao ChatGPT". A busca
// era "contém o texto exato": "blocos" não achava o grupo "BLOCO DE CONCRETO".
// Agora ignora acento e plural, procura em todos os campos de texto e aceita
// várias palavras (todas precisam aparecer em algum campo).

/** Radical simples para o português: tira o plural ("blocos" → "bloco", "telhas" → "telha"). */
function radical(t: string): string {
  if (t.length > 4 && t.endsWith('oes')) return t.slice(0, -3) + 'ao';
  if (t.length > 4 && t.endsWith('aes')) return t.slice(0, -3) + 'ao';
  if (t.length > 4 && t.endsWith('es') && /[rsz]es$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1);
  return t;
}

const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'pra', 'com', 'a', 'o', 'as', 'os']);

export function termosDeBusca(q: string): string[] {
  return normalizarTexto(q)
    .split(' ')
    .filter((t) => t.length >= 2 && !PALAVRAS_VAZIAS.has(t))
    .map(radical);
}

/**
 * Filtra e ordena a base pela busca. Nome e grupo/categoria pesam mais que
 * cidade e observações; sem busca, mantém a ordem original.
 */
export function filtrarBase<T extends Pick<SavedSupplier, 'razaoSocial' | 'nomeFantasia' | 'categoria' | 'cnae' | 'cnaeName' | 'municipio' | 'uf' | 'cnpj' | 'notas' | 'email'>>(
  suppliers: readonly T[],
  q: string,
): T[] {
  const termos = termosDeBusca(q);
  if (termos.length === 0) return [...suppliers];
  const campo = (v: string | null | undefined) => ` ${normalizarTexto(v).split(' ').map(radical).join(' ')} `;
  const pontuados: { s: T; p: number }[] = [];
  for (const s of suppliers) {
    const fortes = campo(`${s.razaoSocial} ${s.nomeFantasia ?? ''} ${s.categoria ?? ''} ${s.cnaeName ?? ''}`);
    const fracos = campo(`${s.cnae ?? ''} ${s.municipio ?? ''} ${s.uf ?? ''} ${s.cnpj ?? ''} ${s.notas ?? ''} ${s.email ?? ''}`);
    let p = 0;
    let todos = true;
    for (const t of termos) {
      if (fortes.includes(` ${t}`)) p += 3;
      else if (fracos.includes(` ${t}`) || fracos.replace(/\D/g, '').includes(t)) p += 1;
      else { todos = false; break; }
    }
    if (todos) pontuados.push({ s, p });
  }
  return pontuados.sort((a, b) => b.p - a.p).map((x) => x.s);
}
