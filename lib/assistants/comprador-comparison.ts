import type { CompradorResult } from './comprador';

// Pivota o comparativo item-a-item (uma entrada por item, cada uma com uma
// lista de status por fornecedor) numa matriz pronta pra tabela HTML — item
// por linha, fornecedor por coluna. A UI (CompradorAssistant) só desenha; o
// pivot fica aqui pra ser testado sem DOM.

type ItemComparativo = CompradorResult['comparativo_itens'][number];
type ItemFornecedorStatus = ItemComparativo['fornecedores'][number];

export type ComparisonMatrixRow = {
  item: string;
  quantidadeSolicitada: string;
  especificacaoSolicitada: string;
  /** Status por fornecedor — undefined quando o fornecedor não cobriu esse item na resposta do modelo. */
  porFornecedor: Record<string, ItemFornecedorStatus | undefined>;
};

export type ComparisonMatrix = {
  /** Nomes únicos de fornecedores, na ordem de primeira aparição. */
  fornecedores: string[];
  rows: ComparisonMatrixRow[];
};

/**
 * Constrói a matriz item × fornecedor a partir de `comparativo_itens`.
 * Retorna `{ fornecedores: [], rows: [] }` pra entrada vazia (sem Pedido de
 * Cotação fornecido — comportamento default, não é erro).
 */
export function buildComparisonMatrix(itens: ItemComparativo[]): ComparisonMatrix {
  const fornecedores: string[] = [];
  const seen = new Set<string>();
  for (const it of itens) {
    for (const f of it.fornecedores) {
      if (!seen.has(f.fornecedor)) {
        seen.add(f.fornecedor);
        fornecedores.push(f.fornecedor);
      }
    }
  }

  const rows: ComparisonMatrixRow[] = itens.map((it) => {
    const porFornecedor: Record<string, ItemFornecedorStatus | undefined> = {};
    for (const f of it.fornecedores) {
      porFornecedor[f.fornecedor] = f;
    }
    return {
      item: it.item,
      quantidadeSolicitada: it.quantidade_solicitada,
      especificacaoSolicitada: it.especificacao_solicitada,
      porFornecedor,
    };
  });

  return { fornecedores, rows };
}
