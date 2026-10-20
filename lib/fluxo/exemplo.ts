import type { FluxoStageId } from './stages';
import type { FluxoProcesso, FluxoStageOutput } from './types';

// Processo de exemplo do Fluxo Automatizado de Compras (vitrine sob demanda,
// 2026-10-20). Dados fictícios, prontos: a tela de exemplo "executa" cada
// etapa mostrando estes resultados, sem chamar IA nem gravar nada. Texto sem
// travessão (regra do produto).

export const EXEMPLO_TITULO = '40 notebooks para o time comercial';

export const EXEMPLO_REQUISICAO = `Tipo: Material
Item ou serviço: notebook i5 (ou equivalente), 16 GB de memória, SSD de 512 GB, tela de 14 polegadas
Quantidade: 40 unidades
Prazo desejado: Em até 30 dias
Área solicitante e local de entrega: Comercial, sede em Curitiba (Rua Exemplo, 100)
Orçamento / centro de custo: até R$ 200 mil, centro de custo 4.102
Justificativa: 40 vendedores contratados para a expansão regional`;

/** O que o comprador "digita" em cada etapa no exemplo. */
export const EXEMPLO_ENTRADAS: Record<FluxoStageId, string> = {
  solicitacao: 'Garantia mínima de 3 anos on-site. Sistema operacional Windows 11 Pro.',
  aprovacao: 'Alçada: até R$ 150 mil o gerente aprova; acima disso, diretoria. Orçamento disponível no CC 4.102: R$ 210 mil.',
  fornecedores: 'Fornecedor atual de TI: Distribuidora Alfa.',
  rfq: 'Exigir preço unitário, frete CIF, prazo de entrega, garantia on-site e validade de 15 dias.',
  analise:
    'Alfa: R$ 4.180/un, frete incluso, 20 dias, garantia 3 anos on-site. Beta: R$ 3.990/un, frete R$ 2.400, 35 dias, garantia 1 ano balcão. Gama: R$ 4.250/un, frete incluso, 12 dias, garantia 3 anos on-site.',
  po: 'Faturar para a matriz, CNPJ da empresa. Entrega na sede, recebimento das 8h às 17h.',
  acompanhamento: 'Fornecedor informou faturamento em 12/11, NF 45.201, transportadora com previsão de entrega em 19/11.',
  recebimento: 'Chegaram 40 notebooks, 1 com a tela trincada. NF confere com o pedido.',
};

export const EXEMPLO_SAIDAS: Record<FluxoStageId, FluxoStageOutput> = {
  solicitacao: {
    resumo:
      'A requisição foi padronizada com especificação, quantidade, prazo, local de entrega e centro de custo. O pedido é de material de TI recorrente, com especificação clara para cotação.',
    campos: [
      { rotulo: 'Categoria', valor: 'TI / Hardware' },
      { rotulo: 'Quantidade', valor: '40 unidades' },
      { rotulo: 'Prazo desejado', valor: 'Até 30 dias' },
      { rotulo: 'Valor estimado', valor: 'R$ 168 mil a R$ 180 mil' },
    ],
    itens: [
      { titulo: 'Notebook 14" i5, 16 GB, SSD 512 GB, Windows 11 Pro', detalhe: '40 unidades, garantia mínima de 3 anos on-site' },
    ],
    pontos_de_revisao: ['Confirme se Windows 11 Pro é padrão da TI', 'Confirme o endereço de entrega'],
    alertas: [],
    saida: 'Solicitação validada: 40 notebooks, até 30 dias, CC 4.102.',
  },
  aprovacao: {
    resumo:
      'O valor estimado passa da alçada do gerente (R$ 150 mil), então a aprovação vai para a diretoria. Há orçamento disponível no centro de custo.',
    campos: [
      { rotulo: 'Aprovador', valor: 'Diretoria comercial' },
      { rotulo: 'Orçamento disponível', valor: 'R$ 210 mil' },
      { rotulo: 'Valor estimado', valor: 'R$ 180 mil' },
    ],
    itens: [],
    pontos_de_revisao: ['Diretoria ciente do valor e do prazo'],
    alertas: ['Valor acima da alçada do gerente: precisa de aprovação da diretoria'],
    saida: 'Solicitação aprovada pela diretoria comercial.',
  },
  fornecedores: {
    resumo:
      'Foram selecionados 3 fornecedores com histórico em TI corporativa, incluindo o atual. Todos com CNPJ ativo e atuação no Paraná.',
    campos: [{ rotulo: 'Fornecedores convidados', valor: '3' }],
    itens: [
      { titulo: 'Distribuidora Alfa', detalhe: 'Fornecedor atual, situação ativa na Receita, risco baixo' },
      { titulo: 'Beta Tecnologia', detalhe: 'Revenda autorizada, situação ativa, risco baixo' },
      { titulo: 'Gama Informática', detalhe: 'Distribuidor regional, situação ativa, risco médio (empresa com 2 anos)' },
    ],
    pontos_de_revisao: ['Confira se algum fornecedor está bloqueado na sua base'],
    alertas: [],
    saida: 'Fornecedores selecionados: Alfa, Beta e Gama.',
  },
  rfq: {
    resumo:
      'O pedido de cotação foi montado com especificação técnica, quantidade, condições comerciais e prazo de resposta de 5 dias úteis, e enviado aos 3 fornecedores.',
    campos: [
      { rotulo: 'Prazo para resposta', valor: '5 dias úteis' },
      { rotulo: 'Validade exigida', valor: '15 dias' },
    ],
    itens: [
      { titulo: 'Exigências', detalhe: 'Preço unitário, frete CIF, prazo de entrega, garantia on-site de 3 anos' },
      { titulo: 'Critério de escolha', detalhe: 'Menor custo total (preço + frete), prazo e garantia' },
    ],
    pontos_de_revisao: ['Confira as condições antes do envio'],
    alertas: [],
    saida: 'Cotações recebidas dos 3 fornecedores.',
  },
  analise: {
    resumo:
      'As 3 propostas foram equalizadas pelo custo total. A Beta tem o menor preço, mas não cumpre a garantia nem o prazo pedidos. A Alfa é a melhor proposta que atende tudo.',
    campos: [
      { rotulo: 'Recomendada', valor: 'Distribuidora Alfa, R$ 167.200' },
      { rotulo: 'Economia sugerida na negociação', valor: 'R$ 3.300 (pedir 2% à vista)' },
    ],
    itens: [
      { titulo: 'Alfa: R$ 167.200', detalhe: 'Frete incluso, 20 dias, garantia 3 anos on-site. Atende tudo.' },
      { titulo: 'Beta: R$ 162.000', detalhe: 'Frete R$ 2.400, 35 dias, garantia 1 ano balcão. Fora do prazo e da garantia.' },
      { titulo: 'Gama: R$ 170.000', detalhe: 'Frete incluso, 12 dias, garantia 3 anos on-site. Mais cara.' },
    ],
    pontos_de_revisao: ['Vale pagar R$ 2.800 a mais na Gama para receber 8 dias antes?'],
    alertas: ['Beta não atende a garantia mínima nem o prazo da requisição'],
    saida: 'Proposta aprovada: Distribuidora Alfa.',
  },
  po: {
    resumo: 'O pedido de compra foi emitido para a Distribuidora Alfa com os valores negociados, prazo e condições de entrega.',
    campos: [
      { rotulo: 'Pedido', valor: 'PO 2026-0418' },
      { rotulo: 'Valor', valor: 'R$ 165.528 (2% de desconto)' },
      { rotulo: 'Entrega até', valor: '20 dias após o pedido' },
    ],
    itens: [{ titulo: '40 x Notebook 14" i5 16 GB SSD 512 GB', detalhe: 'R$ 4.138,20 cada, frete CIF, garantia 3 anos on-site' }],
    pontos_de_revisao: ['Confira dados de faturamento e endereço'],
    alertas: [],
    saida: 'PO emitido e enviado ao fornecedor.',
  },
  acompanhamento: {
    resumo: 'O pedido foi faturado e está com a transportadora. A previsão está dentro do prazo combinado.',
    campos: [
      { rotulo: 'Nota fiscal', valor: '45.201' },
      { rotulo: 'Previsão de entrega', valor: '19/11' },
      { rotulo: 'Situação', valor: 'Dentro do prazo' },
    ],
    itens: [],
    pontos_de_revisao: ['Avise o recebimento da sede sobre a data'],
    alertas: [],
    saida: 'Produto em trânsito, entrega prevista no prazo.',
  },
  recebimento: {
    resumo:
      'Chegaram as 40 unidades e a nota confere com o pedido, mas 1 notebook veio com a tela trincada. O recebimento é parcial até a troca.',
    campos: [
      { rotulo: 'Recebido', valor: '39 de 40 em condições' },
      { rotulo: 'Ocorrência', valor: '1 unidade com tela trincada' },
    ],
    itens: [{ titulo: 'Troca solicitada', detalhe: 'Abrir ocorrência com a Alfa e reter o pagamento de 1 unidade (R$ 4.138,20)' }],
    pontos_de_revisao: ['Fotografe o defeito antes de devolver'],
    alertas: ['Pagar só 39 unidades até a troca chegar'],
    saida: 'Produto recebido e conferido, com 1 troca em aberto.',
  },
};

export function processoExemplo(): FluxoProcesso {
  const agora = new Date().toISOString();
  return {
    id: 'exemplo',
    user_id: 'exemplo',
    titulo: EXEMPLO_TITULO,
    requisicao: EXEMPLO_REQUISICAO,
    etapa_atual: 'solicitacao',
    status: 'em_andamento',
    contexto: {},
    created_at: agora,
    updated_at: agora,
  };
}
