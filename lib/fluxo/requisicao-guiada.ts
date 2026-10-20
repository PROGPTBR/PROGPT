// Modo guiado da abertura de compra (pedido do Alexandre, 2026-10-20:
// "escrever o que eles precisam é muito maçante... se deixássemos as duas
// formas, mas que uma fosse guiada, do tipo ir colocando o que eles precisam").
//
// Perguntas curtas, uma por vez; as respostas viram o mesmo texto livre que a
// etapa 1 do Fluxo já sabe padronizar. Puro, para testar sem tela.

export type CampoGuiado =
  | 'tipo'
  | 'oQue'
  | 'quantidade'
  | 'prazo'
  | 'entrega'
  | 'orcamento'
  | 'justificativa'
  | 'preferencia';

export type PerguntaGuiada = {
  campo: CampoGuiado;
  pergunta: string;
  ajuda: string;
  placeholder: string;
  obrigatoria: boolean;
  /** Respostas rápidas em botão (o texto continua editável). */
  opcoes?: readonly string[];
};

export const PERGUNTAS_GUIADAS: readonly PerguntaGuiada[] = [
  {
    campo: 'tipo',
    pergunta: 'É material ou serviço?',
    ajuda: 'Ajuda a IA a escolher o tipo de fornecedor e de contrato.',
    placeholder: 'Material',
    obrigatoria: true,
    opcoes: ['Material', 'Serviço', 'Material e serviço'],
  },
  {
    campo: 'oQue',
    pergunta: 'O que você precisa?',
    ajuda: 'O item ou serviço com as características que importam (modelo, medida, especificação).',
    placeholder: 'Ex.: notebook i5, 16 GB de memória, SSD de 512 GB',
    obrigatoria: true,
  },
  {
    campo: 'quantidade',
    pergunta: 'Quantos?',
    ajuda: 'Quantidade e unidade, ou a frequência se for recorrente.',
    placeholder: 'Ex.: 40 unidades',
    obrigatoria: true,
  },
  {
    campo: 'prazo',
    pergunta: 'Para quando?',
    ajuda: 'A data em que precisa ter o item ou o serviço começando.',
    placeholder: 'Ex.: até 15/11',
    obrigatoria: true,
    opcoes: ['Urgente, até 7 dias', 'Em até 15 dias', 'Em até 30 dias', 'Sem pressa'],
  },
  {
    campo: 'entrega',
    pergunta: 'Para qual área e onde entregar?',
    ajuda: 'Quem pediu e o local de entrega ou de execução.',
    placeholder: 'Ex.: time comercial, sede em Curitiba',
    obrigatoria: true,
  },
  {
    campo: 'orcamento',
    pergunta: 'Tem orçamento ou centro de custo?',
    ajuda: 'Se não souber, pode pular: a IA aponta na aprovação.',
    placeholder: 'Ex.: até R$ 180 mil, centro de custo 4.102',
    obrigatoria: false,
  },
  {
    campo: 'justificativa',
    pergunta: 'Por que precisa?',
    ajuda: 'Uma frase basta. Ajuda na aprovação.',
    placeholder: 'Ex.: equipes novas contratadas em novembro',
    obrigatoria: false,
  },
  {
    campo: 'preferencia',
    pergunta: 'Tem fornecedor ou marca de preferência?',
    ajuda: 'Opcional. A IA ainda busca alternativas.',
    placeholder: 'Ex.: Dell ou Lenovo; fornecedor atual X',
    obrigatoria: false,
  },
];

export type RespostasGuiadas = Partial<Record<CampoGuiado, string>>;

const ROTULO: Record<CampoGuiado, string> = {
  tipo: 'Tipo',
  oQue: 'Item ou serviço',
  quantidade: 'Quantidade',
  prazo: 'Prazo desejado',
  entrega: 'Área solicitante e local de entrega',
  orcamento: 'Orçamento / centro de custo',
  justificativa: 'Justificativa',
  preferencia: 'Preferência de fornecedor ou marca',
};

/** Faltam respostas obrigatórias? Devolve as perguntas pendentes. */
export function pendentes(r: RespostasGuiadas): PerguntaGuiada[] {
  return PERGUNTAS_GUIADAS.filter((p) => p.obrigatoria && !(r[p.campo] ?? '').trim());
}

/** Monta título e texto da requisição a partir das respostas. */
export function montarRequisicao(r: RespostasGuiadas): { titulo: string; requisicao: string } {
  const limpo = (c: CampoGuiado) => (r[c] ?? '').replace(/\s+/g, ' ').trim();
  const linhas = PERGUNTAS_GUIADAS.map((p) => p.campo)
    .filter((c) => limpo(c))
    .map((c) => `${ROTULO[c]}: ${limpo(c)}`);
  const oQue = limpo('oQue');
  const qtd = limpo('quantidade');
  const titulo = oQue ? `${qtd ? `${qtd} de ` : ''}${oQue}`.slice(0, 120) : '';
  return { titulo, requisicao: linhas.join('\n') };
}
