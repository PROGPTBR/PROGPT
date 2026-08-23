// Tipos da base de materiais (vendor-neutral SKU master do comprador) —
// Batch L do backlog do diretor. Espelha lib/suppliers/base.ts. Puro (sem
// DB/DOM) pra ser usado na UI e testado isolado.

export type SavedMaterial = {
  id: string;
  codigo: string | null;
  descricao: string;
  categoria: string | null;
  unidade: string | null;
  ncm: string | null;
  fornecedorPadraoCnpj: string | null;
  precoUltimo: number | null;
  moeda: string | null;
  createdAt: number;
  updatedAt: number;
};

// Campos que o usuário edita na base (o resto é derivado/imutável).
export type MaterialPatch = Partial<
  Pick<
    SavedMaterial,
    'descricao' | 'categoria' | 'unidade' | 'ncm' | 'fornecedorPadraoCnpj' | 'precoUltimo' | 'moeda'
  >
>;

export type NewMaterialInput = {
  codigo?: string | null;
  descricao: string;
  categoria?: string | null;
  unidade?: string | null;
  ncm?: string | null;
  fornecedorPadraoCnpj?: string | null;
  precoUltimo?: number | null;
  moeda?: string | null;
};

/** Normaliza um código de material: trim; '' vira null (chave ausente). */
export function codigoOf(codigo: string | null | undefined): string | null {
  const t = (codigo ?? '').trim();
  return t.length > 0 ? t : null;
}
