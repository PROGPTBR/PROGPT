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
export function cnpjBasicoOf(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  const d = cnpj.replace(/\D/g, '');
  return d.length >= 8 ? d.slice(0, 8) : null;
}
