import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/supabase', () => ({ getServerSupabase: () => ({}) }));
vi.mock('@/lib/email/client', () => ({ sendEmail: vi.fn() }));
vi.mock('@/lib/chat-attachments', () => ({ parseChatAttachment: vi.fn() }));

import { visaoAlmoxarifado, visaoFornecedor, type PedidoCompleto } from '@/lib/recebimento/service';
import { conferirNota, saldoDoPedido } from '@/lib/recebimento/conferencia';
import type { NotaLida, RecebimentoNota, RecebimentoPedido } from '@/lib/recebimento/types';

const itens = [
  { codigo: 'A1', descricao: 'Cimento CP II 50kg', ncm: '25232910', unidade: 'SC', quantidade: 100, valor_unitario: 34.9, icms_pct: 18, ipi_pct: 0 },
];

function nota(finalidade: RecebimentoNota['finalidade'], numero: string, preco: number): RecebimentoNota {
  const lida: NotaLida = {
    numero,
    serie: '1',
    chave: '',
    emitente_nome: 'Fornecedor X',
    emitente_cnpj: '',
    data_emissao: '2026-11-05',
    natureza: '',
    valor_total: preco * 100,
    itens: [{ codigo: 'F1', descricao: 'Cimento CP II 50kg', ncm: '25239000', cfop: '5102', unidade: 'SC', quantidade: 100, valor_unitario: preco, valor_total: preco * 100, icms_pct: 12, ipi_pct: null }],
  };
  return {
    ...lida,
    id: `n-${numero}`,
    pedido_id: 'p1',
    user_id: 'u1',
    finalidade,
    origem: 'xml',
    enviado_por: 'fornecedor',
    conferencia: conferirNota({ pedido: { itens, fornecedor_cnpj: '' }, nota: lida, finalidade }),
    arquivo_nome: 'nota.xml',
    arquivo_path: 'u1/p1/nota.xml',
    created_at: '2026-11-05T12:00:00Z',
  };
}

const completo: PedidoCompleto = {
  pedido: {
    id: 'p1',
    user_id: 'u1',
    numero: 'PO-1',
    titulo: '',
    fornecedor_nome: 'Fornecedor X',
    fornecedor_cnpj: '',
    fornecedor_email: '',
    almoxarifado_nome: '',
    almoxarifado_email: '',
    financeiro_nome: '',
    financeiro_email: '',
    condicoes: 'Pagamento 28 dias',
    itens,
    valor_total: 3490,
    status: 'aguardando_entrega',
    fornecedor_token: 'tf',
    almoxarifado_token: 'ta',
    financeiro_token: 'tfin',
    pagamento_liberado_em: null,
    pagamento_liberado_por: null,
    created_at: '',
    updated_at: '',
  } satisfies RecebimentoPedido,
  notas: [nota('entrega', '10', 777.77), nota('financeira', '11', 888.88)],
  entradas: [{ id: 'e1', pedido_id: 'p1', user_id: 'u1', nota_id: null, itens: [{ item: 0, quantidade: 40, ressalva: 'saco rasgado' }], responsavel: 'Zé', observacao: '', created_at: '' }],
  saldo: saldoDoPedido(itens, [{ itens: [{ item: 0, quantidade: 40, ressalva: 'saco rasgado' }] }]),
};

describe('o que cada papel vê', () => {
  it('o almoxarifado não recebe valor nenhum, nem a nota financeira, nem apontamento de imposto/NCM', () => {
    const v = visaoAlmoxarifado(completo);
    const json = JSON.stringify(v);
    for (const proibido of ['valor', '34.9', '3490', '777', '888', 'preço', 'Preço', 'ICMS', 'NCM', 'token', 'condicoes', '28 dias']) {
      expect(json).not.toContain(proibido);
    }
    expect(v.notasEntrega.map((n) => n.numero)).toEqual(['10']);
    expect(v.saldo[0]).toMatchObject({ recebida: 40, pendente: 60 });
  });

  it('o fornecedor vê o pedido e o pendente, mas não a conferência nem as ressalvas', () => {
    const v = visaoFornecedor(completo, 'Construtora Y');
    const json = JSON.stringify(v);
    expect(json).not.toContain('saco rasgado');
    expect(json).not.toContain('apontamentos');
    expect(json).not.toContain('token');
    expect(v.itens[0]!.valor_unitario).toBe(34.9);
    expect(v.saldo[0]!.pendente).toBe(60);
  });
});
