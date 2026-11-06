import type { PedidoInput } from './types';

// "Carregar exemplo" do cadastro de pedido (sub-projeto 95): um pedido de obra
// com alíquotas e NCM informados, para a conferência ter o que conferir.
export const PEDIDO_EXEMPLO: PedidoInput = {
  numero: 'PO-2026-0142',
  titulo: 'Material de estrutura, Torre B',
  fornecedor_nome: 'Casa do Construtor Materiais Ltda',
  fornecedor_cnpj: '',
  fornecedor_email: '',
  almoxarifado_nome: '',
  almoxarifado_email: '',
  financeiro_nome: '',
  financeiro_email: '',
  condicoes: 'Entrega em até 10 dias no canteiro da Torre B. Pagamento 28 dias após o OK do almoxarifado. Frete CIF.',
  itens: [
    { codigo: 'MAT-0101', descricao: 'Cimento CP II-F 32 saco 50 kg', ncm: '25232910', unidade: 'SC', quantidade: 300, valor_unitario: 34.9, icms_pct: 18, ipi_pct: 0 },
    { codigo: 'MAT-0207', descricao: 'Vergalhão CA-50 10 mm barra 12 m', ncm: '72142000', unidade: 'BR', quantidade: 180, valor_unitario: 42.5, icms_pct: 12, ipi_pct: 5 },
    { codigo: 'MAT-0233', descricao: 'Arame recozido 18 BWG rolo 1 kg', ncm: '72171090', unidade: 'RL', quantidade: 60, valor_unitario: 18.4, icms_pct: 18, ipi_pct: 5 },
    { codigo: 'MAT-0310', descricao: 'Areia média lavada', ncm: '25059000', unidade: 'M3', quantidade: 24, valor_unitario: 145, icms_pct: 18, ipi_pct: 0 },
  ],
};
