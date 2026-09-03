import { describe, expect, it } from 'vitest';
import { buildComparisonMatrix } from '@/lib/assistants/comprador-comparison';
import type { CompradorResult } from '@/lib/assistants/comprador';

type Itens = CompradorResult['comparativo_itens'];

describe('buildComparisonMatrix', () => {
  it('returns empty fornecedores/rows for an empty input (no Pedido de Cotação provided)', () => {
    expect(buildComparisonMatrix([])).toEqual({ fornecedores: [], rows: [] });
  });

  it('extracts unique fornecedores in order of first appearance', () => {
    const itens: Itens = [
      {
        item: 'Palete PBR',
        quantidade_solicitada: '200un',
        especificacao_solicitada: 'madeira de pinus',
        fornecedores: [
          { fornecedor: 'A', status: 'correto', detalhe: 'conforme solicitado' },
          { fornecedor: 'B', status: 'marca_diferente', detalhe: 'madeira de eucalipto' },
        ],
      },
      {
        item: 'Cantoneira',
        quantidade_solicitada: '400un',
        especificacao_solicitada: 'papelão',
        fornecedores: [
          { fornecedor: 'B', status: 'condicao_diferente', detalhe: 'plástico em vez de papelão' },
          { fornecedor: 'C', status: 'correto', detalhe: 'conforme solicitado' },
        ],
      },
    ];
    const matrix = buildComparisonMatrix(itens);
    expect(matrix.fornecedores).toEqual(['A', 'B', 'C']);
  });

  it('preserves the input item order in rows', () => {
    const itens: Itens = [
      { item: 'Item 1', quantidade_solicitada: '1', especificacao_solicitada: '', fornecedores: [] },
      { item: 'Item 2', quantidade_solicitada: '2', especificacao_solicitada: '', fornecedores: [] },
    ];
    const matrix = buildComparisonMatrix(itens);
    expect(matrix.rows.map((r) => r.item)).toEqual(['Item 1', 'Item 2']);
  });

  it('builds porFornecedor by name and leaves suppliers who did not cover the item as undefined', () => {
    const itens: Itens = [
      {
        item: 'Palete PBR',
        quantidade_solicitada: '200un',
        especificacao_solicitada: 'madeira de pinus',
        fornecedores: [{ fornecedor: 'A', status: 'ausente', detalhe: 'não cotou esse item' }],
      },
    ];
    const matrix = buildComparisonMatrix(itens);
    expect(matrix.rows[0]!.porFornecedor['A']).toEqual({
      fornecedor: 'A',
      status: 'ausente',
      detalhe: 'não cotou esse item',
    });
    // "B" never appeared in the data at all — not a key vs. undefined distinction
    // matters for the UI's cell lookup, both read as "no data" via bracket access.
    expect(matrix.rows[0]!.porFornecedor['B']).toBeUndefined();
  });

  it('carries quantidade/especificação solicitada through to the row', () => {
    const itens: Itens = [
      {
        item: 'Palete PBR',
        quantidade_solicitada: '200un',
        especificacao_solicitada: 'madeira de pinus tratada',
        fornecedores: [],
      },
    ];
    const matrix = buildComparisonMatrix(itens);
    expect(matrix.rows[0]).toMatchObject({
      quantidadeSolicitada: '200un',
      especificacaoSolicitada: 'madeira de pinus tratada',
    });
  });
});
