// Fluxo Automatizado de Compras — as 8 etapas.
//
// Transcrição fiel da planilha `Fluxo_Automatizado_Compras_PROGPT.xlsx`
// (aba "Operação" = contrato funcional; aba "Fluxo Visual" = os textos longos
// de automação e revisão). NÃO editar de memória: se a planilha mudar, mude
// aqui junto e ajuste os testes que travam a numeração e a ordem.
//
// A lógica do processo, literal da fonte:
//   IA/Sistema executa → Comprador revisa → SIGA avança / AJUSTAR corrige.

export const FLUXO_STAGE_IDS = [
  'solicitacao',
  'aprovacao',
  'fornecedores',
  'rfq',
  'analise',
  'po',
  'acompanhamento',
  'recebimento',
] as const;

export type FluxoStageId = (typeof FLUXO_STAGE_IDS)[number];

/** Trilha do processo. Na planilha, S2C cobre as etapas 1–4 e P2P as 5–8. */
export type FluxoTrilha = 's2c' | 'p2p';

export type FluxoStage = {
  num: number;
  id: FluxoStageId;
  label: string;
  trilha: FluxoTrilha;
  /** O que precisa estar pronto para a etapa rodar. */
  entrada: string;
  /** O que a IA/sistema faz sozinho (texto curto da aba Operação). */
  automacao: string;
  /** Versão longa da automação (aba Fluxo Visual) — vira instrução do prompt. */
  automacaoDetalhe: string;
  /** O que o comprador confere antes de decidir. */
  revisao: string;
  revisaoDetalhe: string;
  /** Rótulos das duas decisões possíveis. */
  seSiga: string;
  seAjustar: string;
  /** Frase de saída quando a etapa é aprovada. */
  saida: string;
  /** Texto que o comprador pode colar ANTES de rodar a etapa. A planilha
   *  presume que dado externo entra no processo (propostas recebidas,
   *  tracking, nota de recebimento) — sem isso a IA inventaria. */
  entrada_do_usuario: { rotulo: string; placeholder: string };
};

export const FLUXO_STAGES: FluxoStage[] = [
  {
    num: 1,
    id: 'solicitacao',
    label: 'Solicitação de Compra',
    trilha: 's2c',
    entrada: 'Nova requisição',
    automacao: 'Padronizar dados, classificar categoria e validar política',
    automacaoDetalhe:
      'Padronize a descrição, a categoria, a quantidade, o centro de custo e o prazo; verifique aderência à política de compras e a contratos vigentes.',
    revisao: 'Especificação, quantidade, prazo e orçamento',
    revisaoDetalhe:
      'Necessidade, especificação, quantidade, prazo, orçamento e justificativa.',
    seSiga: 'Avançar para aprovação',
    seAjustar: 'Voltar para edição',
    saida: 'Solicitação validada',
    entrada_do_usuario: {
      rotulo: 'Detalhes adicionais da requisição',
      placeholder:
        'Centro de custo, orçamento aprovado, justificativa, prazo desejado…',
    },
  },
  {
    num: 2,
    id: 'aprovacao',
    label: 'Aprovação da Solicitação',
    trilha: 's2c',
    entrada: 'Solicitação validada',
    automacao: 'Identificar alçada e aprovador',
    automacaoDetalhe:
      'Identifique a alçada aplicável pelo valor e pela categoria e indique o aprovador correto; aponte o que falta para a aprovação sair.',
    revisao: 'Orçamento, prioridade e centro de custo',
    revisaoDetalhe: 'Orçamento, prioridade, centro de custo e necessidade.',
    seSiga: 'Registrar aprovação',
    seAjustar: 'Solicitar correção/justificativa',
    saida: 'Solicitação aprovada',
    entrada_do_usuario: {
      rotulo: 'Política de alçada e orçamento',
      placeholder:
        'Quem aprova até quanto, verba disponível no centro de custo…',
    },
  },
  {
    num: 3,
    id: 'fornecedores',
    label: 'Seleção de Fornecedores',
    trilha: 's2c',
    entrada: 'Solicitação aprovada',
    automacao: 'Pesquisar base, risco, compliance e performance',
    automacaoDetalhe:
      'Pesquise fornecedores aptos e avalie homologação, risco, compliance e histórico de performance; proponha uma lista curta com o critério de cada escolha.',
    revisao: 'Shortlist e critérios',
    revisaoDetalhe: 'Shortlist, riscos, performance e aderência técnica.',
    seSiga: 'Confirmar fornecedores',
    seAjustar: 'Editar shortlist',
    saida: 'Fornecedores selecionados',
    entrada_do_usuario: {
      rotulo: 'Fornecedores candidatos (opcional)',
      placeholder:
        'Cole a lista de fornecedores, com CNPJ se tiver — o sistema consulta a situação fiscal de cada um.',
    },
  },
  {
    num: 4,
    id: 'rfq',
    label: 'RFQ / Cotação',
    trilha: 's2c',
    entrada: 'Fornecedores selecionados',
    automacao: 'Gerar e enviar RFQ/RFP',
    automacaoDetalhe:
      'Monte o RFQ/RFP: escopo, quantidades, critérios de julgamento, condições comerciais e prazo de resposta, pronto para disparar aos fornecedores selecionados.',
    revisao: 'Escopo, condições e critérios',
    revisaoDetalhe:
      'Escopo, condições comerciais, critérios e fornecedores convidados.',
    seSiga: 'Disparar RFQ',
    seAjustar: 'Editar RFQ',
    saida: 'Cotações recebidas',
    entrada_do_usuario: {
      rotulo: 'Condições que o RFQ deve exigir',
      placeholder:
        'Prazo de resposta, critérios de julgamento, condições de pagamento, local de entrega…',
    },
  },
  {
    num: 5,
    id: 'analise',
    label: 'Análise e Negociação',
    trilha: 'p2p',
    entrada: 'Propostas recebidas',
    automacao: 'Equalizar propostas, TCO, tributos e riscos',
    automacaoDetalhe:
      'Equalize as propostas em base comparável: preço, frete, impostos, prazo, condição de pagamento e riscos. Recomende a melhor proposta por TCO e liste os pontos de negociação.',
    revisao: 'Comparativo e recomendação',
    revisaoDetalhe: 'Mapa comparativo, divergências, riscos e recomendação.',
    seSiga: 'Selecionar proposta',
    seAjustar: 'Nova rodada/ajuste',
    saida: 'Proposta aprovada',
    entrada_do_usuario: {
      rotulo: 'Propostas recebidas',
      placeholder:
        'Cole aqui as propostas dos fornecedores (preço, frete, impostos, prazo, condição de pagamento).',
    },
  },
  {
    num: 6,
    id: 'po',
    label: 'Pedido de Compra (PO)',
    trilha: 'p2p',
    entrada: 'Proposta aprovada',
    automacao: 'Gerar e enviar pedido de compra',
    automacaoDetalhe:
      'Monte o pedido de compra a partir da proposta vencedora: itens, quantidades, preço final, impostos, prazo de entrega, condição de pagamento e termos.',
    revisao: 'Preço, impostos, prazo e termos',
    revisaoDetalhe:
      'Preço final, impostos, prazo, pagamento, endereço e termos.',
    seSiga: 'Emitir PO',
    seAjustar: 'Corrigir PO',
    saida: 'PO emitido',
    entrada_do_usuario: {
      rotulo: 'Dados de faturamento e entrega',
      placeholder:
        'CNPJ de faturamento, endereço de entrega, condição de pagamento acordada…',
    },
  },
  {
    num: 7,
    id: 'acompanhamento',
    label: 'Acompanhamento da Entrega',
    trilha: 'p2p',
    entrada: 'PO confirmado',
    automacao: 'Monitorar tracking, prazo e desvios',
    automacaoDetalhe:
      'Acompanhe produção, expedição e prazo prometido; aponte risco de atraso, desvios e o que exige tratativa com o fornecedor.',
    revisao: 'Alertas e exceções',
    revisaoDetalhe: 'Prazo prometido, status logístico e risco de atraso.',
    seSiga: 'Continuar até entrega',
    seAjustar: 'Abrir tratativa',
    saida: 'Produto em trânsito',
    entrada_do_usuario: {
      rotulo: 'Status informado pelo fornecedor',
      placeholder:
        'Cole o tracking, a previsão de embarque ou o retorno do fornecedor.',
    },
  },
  {
    num: 8,
    id: 'recebimento',
    label: 'Recebimento na Empresa',
    trilha: 'p2p',
    entrada: 'Produto entregue',
    automacao: 'Registrar entrada e conferir PO x recebido',
    automacaoDetalhe:
      'Confira o recebido contra o pedido: quantidade, qualidade e conformidade. Registre divergências e diga se o recebimento pode ser aceito.',
    revisao: 'Quantidade, qualidade e divergências',
    revisaoDetalhe: 'Quantidade, qualidade, conformidade e divergências.',
    seSiga: 'Aceitar recebimento',
    seAjustar: 'Registrar divergência',
    saida: 'Produto recebido e conferido',
    entrada_do_usuario: {
      rotulo: 'O que chegou de fato',
      placeholder:
        'Cole a nota fiscal, o romaneio ou descreva quantidade, qualidade e divergências.',
    },
  },
];

export const TOTAL_ETAPAS = FLUXO_STAGES.length;

export function getStage(id: string): FluxoStage | null {
  return FLUXO_STAGES.find((s) => s.id === id) ?? null;
}

export function getStageByNum(num: number): FluxoStage | null {
  return FLUXO_STAGES.find((s) => s.num === num) ?? null;
}

export function isFluxoStageId(value: unknown): value is FluxoStageId {
  return (
    typeof value === 'string' &&
    (FLUXO_STAGE_IDS as readonly string[]).includes(value)
  );
}

/** Próxima etapa depois de um SIGA. `null` = fim do processo. */
export function proximaEtapa(id: FluxoStageId): FluxoStage | null {
  const atual = getStage(id);
  if (!atual) return null;
  return getStageByNum(atual.num + 1);
}
