// Vitrine "Gestão de Demandas" (sub-projeto 68) — Solicitações de Providência
// (SPs) entre setores. Regras portadas do sistema de origem (status, semáforo
// de prazo, ciclo de vida, colunas do quadro de fluxo) e um conjunto de
// exemplos montado à mão. Tudo é puro e em memória: a demo nunca grava nada.
//
// As datas dos exemplos são DESLOCAMENTOS em dias a partir de `now`, para que
// "3 dias em atraso" / "vence hoje" continuem verdadeiros em qualquer dia em
// que alguém abra a demonstração.

import { diasEntre, isoDia } from './datas';

export type SpStatus =
  | 'aberta'
  | 'em_andamento'
  | 'aguardando_resposta'
  | 'aguardando_validacao'
  | 'concluida'
  | 'cancelada';

export const STATUS_ORDER: SpStatus[] = [
  'aberta',
  'em_andamento',
  'aguardando_resposta',
  'aguardando_validacao',
  'concluida',
  'cancelada',
];

export const STATUS_LABEL: Record<SpStatus, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  aguardando_resposta: 'Aguardando resposta',
  aguardando_validacao: 'Aguardando validação',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export type Setor = { slug: string; nome: string; cor: string };

export type Pessoa = {
  id: string;
  nome: string;
  cargo: string;
  setor: string;
};

export type SpEvento = {
  /** Dias relativos a `now` (negativo = passado). */
  dia: number;
  pessoa: string;
  tipo: keyof typeof EVENTO_LABEL;
  texto?: string;
};

export type SpExemplo = {
  id: string;
  setor: string;
  seq: number;
  tema: string;
  objetivo: string;
  pendencias: string;
  solicitante: string;
  emissor: string;
  responsaveis: string[];
  /** Datas como deslocamento em dias a partir de `now`. */
  emissao: number;
  prevista: number;
  conclusao?: number;
  recebida: boolean;
  percentual: number;
  status: SpStatus;
  anexos: string[];
  prorrogacao?: { dias: number; motivo: string; situacao: 'pendente' | 'aprovada' | 'recusada' };
  eventos: SpEvento[];
};

/** SP com as datas já resolvidas para um `now` concreto. */
export type Sp = Omit<SpExemplo, 'emissao' | 'prevista' | 'conclusao' | 'eventos'> & {
  codigo: string;
  dataEmissao: string;
  dataPrevista: string;
  dataConclusao: string | null;
  eventos: (Omit<SpEvento, 'dia'> & { data: string })[];
};

export const EVENTO_LABEL = {
  criacao: 'criou a SP',
  recebimento: 'confirmou o recebimento da SP',
  resposta: 'registrou uma resposta',
  percentual: 'atualizou o percentual',
  anexo: 'incluiu anexos',
  prazo_solicitado: 'solicitou prorrogação de prazo',
  prazo_aprovado: 'aprovou a prorrogação',
  conclusao: 'enviou a entrega para validação',
  validacao: 'validou a entrega',
  reabertura: 'devolveu a SP para ajustes',
  cancelamento: 'cancelou a SP',
} as const;

// ─── Regras (portadas do sistema de origem) ───────────────────────────────

export type PrazoTom = 'verde' | 'amarelo' | 'vermelho' | 'neutro';

export type PrazoInfo = {
  tom: PrazoTom;
  label: string;
  /** Dias restantes (negativo = atraso). */
  dias: number;
  atrasada: boolean;
};

/** Dias de antecedência a partir dos quais o prazo fica amarelo. */
export const DIAS_ATENCAO = 5;

export function calcularPrazo(
  sp: Pick<Sp, 'status' | 'dataPrevista'>,
  hojeIso: string,
  diasAtencao = DIAS_ATENCAO,
): PrazoInfo {
  if (sp.status === 'concluida') return { tom: 'verde', label: 'Concluída', dias: 0, atrasada: false };
  if (sp.status === 'cancelada') return { tom: 'neutro', label: 'Cancelada', dias: 0, atrasada: false };

  const dias = diasEntre(hojeIso, sp.dataPrevista);
  if (dias < 0) {
    const n = Math.abs(dias);
    return { tom: 'vermelho', label: `${n} ${n === 1 ? 'dia' : 'dias'} em atraso`, dias, atrasada: true };
  }
  if (dias === 0) return { tom: 'amarelo', label: 'Vence hoje', dias, atrasada: false };
  return {
    tom: dias <= diasAtencao ? 'amarelo' : 'verde',
    label: `${dias} ${dias === 1 ? 'dia restante' : 'dias restantes'}`,
    dias,
    atrasada: false,
  };
}

export const CICLO_DE_VIDA = ['Aberta', 'Em andamento', 'Validação', 'Concluída'] as const;

/** Posição da SP no ciclo de vida do cartão (-1 = cancelada). */
export function etapaDoCiclo(status: SpStatus): number {
  switch (status) {
    case 'aberta':
      return 0;
    case 'em_andamento':
    case 'aguardando_resposta':
      return 1;
    case 'aguardando_validacao':
      return 2;
    case 'concluida':
      return 3;
    default:
      return -1;
  }
}

export type FluxoColuna = 'enviada' | 'recebida' | 'em_andamento' | 'aguardando_validacao' | 'concluida';

export const FLUXO_COLUNAS: { id: FluxoColuna; label: string; comoEntra: string }[] = [
  { id: 'enviada', label: 'Enviada', comoEntra: 'Criada e ainda sem confirmação de recebimento do setor de destino.' },
  { id: 'recebida', label: 'Recebida', comoEntra: 'O gestor do setor de destino confirmou o recebimento.' },
  { id: 'em_andamento', label: 'Em andamento', comoEntra: 'O responsável começou a trabalhar.' },
  { id: 'aguardando_validacao', label: 'Aguardando validação', comoEntra: 'A entrega espera o aceite de quem solicitou.' },
  { id: 'concluida', label: 'Concluída', comoEntra: 'Quem solicitou validou a entrega.' },
];

/**
 * Coluna do quadro de fluxo. Não é um campo próprio: deriva do status e do
 * recebimento, então o cartão "anda sozinho" (canceladas ficam fora do quadro).
 */
export function colunaDoFluxo(sp: Pick<Sp, 'status' | 'recebida' | 'percentual'>): FluxoColuna | null {
  switch (sp.status) {
    case 'cancelada':
      return null;
    case 'concluida':
      return 'concluida';
    case 'aguardando_validacao':
      return 'aguardando_validacao';
    case 'em_andamento':
    case 'aguardando_resposta':
      return 'em_andamento';
    default:
      if (!sp.recebida) return 'enviada';
      return sp.percentual > 0 ? 'em_andamento' : 'recebida';
  }
}

export function formatarCodigo(prefixo: string, setor: string, seq: number, ano: number): string {
  return `${prefixo}-${setor}-${String(seq).padStart(2, '0')}/${ano}`;
}

// ─── Indicadores da Visão Geral ───────────────────────────────────────────

export type IndicadoresDemandas = {
  total: number;
  abertas: number;
  emAndamento: number;
  aguardandoValidacao: number;
  concluidas: number;
  emAtraso: number;
  /** % das concluídas entregues até a data prevista (null sem concluídas). */
  conclusaoNoPrazo: number | null;
  /** Média de dias entre emissão e conclusão (null sem concluídas). */
  tempoMedioDias: number | null;
};

export function calcularIndicadores(sps: Sp[], hojeIso: string): IndicadoresDemandas {
  const concluidas = sps.filter((s) => s.status === 'concluida' && s.dataConclusao);
  const noPrazo = concluidas.filter((s) => diasEntre(s.dataConclusao!, s.dataPrevista) >= 0).length;
  const duracoes = concluidas.map((s) => diasEntre(s.dataEmissao, s.dataConclusao!));

  return {
    total: sps.length,
    abertas: sps.filter((s) => s.status === 'aberta').length,
    emAndamento: sps.filter((s) => s.status === 'em_andamento' || s.status === 'aguardando_resposta').length,
    aguardandoValidacao: sps.filter((s) => s.status === 'aguardando_validacao').length,
    concluidas: concluidas.length,
    emAtraso: sps.filter((s) => calcularPrazo(s, hojeIso).atrasada).length,
    conclusaoNoPrazo: concluidas.length ? Math.round((noPrazo / concluidas.length) * 100) : null,
    tempoMedioDias: duracoes.length
      ? Math.round((duracoes.reduce((a, b) => a + b, 0) / duracoes.length) * 10) / 10
      : null,
  };
}

export function contarPorStatus(sps: Sp[]): { status: SpStatus; total: number }[] {
  return STATUS_ORDER.map((status) => ({ status, total: sps.filter((s) => s.status === status).length }));
}

export function contarPorSetor(
  sps: Sp[],
  setores: Setor[],
  hojeIso: string,
): { setor: Setor; total: number; abertas: number; atrasadas: number }[] {
  return setores.map((setor) => {
    const doSetor = sps.filter((s) => s.setor === setor.slug);
    return {
      setor,
      total: doSetor.length,
      abertas: doSetor.filter((s) => s.status !== 'concluida' && s.status !== 'cancelada').length,
      atrasadas: doSetor.filter((s) => calcularPrazo(s, hojeIso).atrasada).length,
    };
  });
}

// ─── Dados de exemplo ─────────────────────────────────────────────────────

export const PREFIXO_SP = 'SP';

export const SETORES: Setor[] = [
  { slug: 'MKT', nome: 'Marketing', cor: '#2563eb' },
  { slug: 'COM', nome: 'Comercial', cor: '#0891b2' },
  { slug: 'ENG', nome: 'Engenharia', cor: '#7c3aed' },
  { slug: 'FIN', nome: 'Financeiro', cor: '#059669' },
  { slug: 'RH', nome: 'Recursos Humanos', cor: '#db2777' },
  { slug: 'ADM', nome: 'Administrativo', cor: '#ca8a04' },
  { slug: 'QP', nome: 'Qualidade e Processos', cor: '#0d9488' },
  { slug: 'TI', nome: 'Tecnologia da Informação', cor: '#4f46e5' },
];

export const PESSOAS: Pessoa[] = [
  { id: 'ana', nome: 'Ana Ribeiro', cargo: 'Diretora de Operações', setor: 'ADM' },
  { id: 'bruno', nome: 'Bruno Carvalho', cargo: 'Gestor de Marketing', setor: 'MKT' },
  { id: 'carla', nome: 'Carla Menezes', cargo: 'Analista de Marketing', setor: 'MKT' },
  { id: 'diego', nome: 'Diego Fontes', cargo: 'Gestor Comercial', setor: 'COM' },
  { id: 'elisa', nome: 'Elisa Prado', cargo: 'Engenheira de Projetos', setor: 'ENG' },
  { id: 'fabio', nome: 'Fábio Teixeira', cargo: 'Gestor de Engenharia', setor: 'ENG' },
  { id: 'gabriela', nome: 'Gabriela Lins', cargo: 'Gestora Financeira', setor: 'FIN' },
  { id: 'heitor', nome: 'Heitor Martins', cargo: 'Analista Financeiro', setor: 'FIN' },
  { id: 'iara', nome: 'Iara Souza', cargo: 'Gestora de RH', setor: 'RH' },
  { id: 'joao', nome: 'João Pedro Alves', cargo: 'Analista de Processos', setor: 'QP' },
  { id: 'karen', nome: 'Karen Duarte', cargo: 'Coordenadora de TI', setor: 'TI' },
  { id: 'lucas', nome: 'Lucas Nogueira', cargo: 'Suporte de TI', setor: 'TI' },
];

const SPS_EXEMPLO: SpExemplo[] = [
  {
    id: 'sp-1', setor: 'MKT', seq: 8, tema: 'Campanha de lançamento da linha 2027',
    objetivo: 'Planejar e produzir a campanha digital de lançamento da nova linha, com peças para redes sociais e e-mail.',
    pendencias: 'Aprovação do orçamento de mídia paga pelo Financeiro.',
    solicitante: 'diego', emissor: 'diego', responsaveis: ['carla'],
    emissao: -18, prevista: 6, recebida: true, percentual: 55, status: 'em_andamento',
    anexos: ['briefing-campanha-2027.pdf', 'cronograma-midia.xlsx'],
    eventos: [
      { dia: -18, pessoa: 'diego', tipo: 'criacao' },
      { dia: -17, pessoa: 'bruno', tipo: 'recebimento' },
      { dia: -10, pessoa: 'carla', tipo: 'anexo', texto: 'cronograma-midia.xlsx' },
      { dia: -3, pessoa: 'carla', tipo: 'percentual', texto: '55%' },
    ],
  },
  {
    id: 'sp-2', setor: 'FIN', seq: 14, tema: 'Conciliação bancária de setembro',
    objetivo: 'Concluir a conciliação das contas correntes e aplicações referentes ao fechamento de setembro.',
    pendencias: 'Extrato da conta de aplicação ainda não enviado pelo banco.',
    solicitante: 'ana', emissor: 'ana', responsaveis: ['heitor'],
    emissao: -12, prevista: -3, recebida: true, percentual: 80, status: 'em_andamento',
    anexos: ['extratos-setembro.zip'],
    eventos: [
      { dia: -12, pessoa: 'ana', tipo: 'criacao' },
      { dia: -12, pessoa: 'gabriela', tipo: 'recebimento' },
      { dia: -5, pessoa: 'heitor', tipo: 'percentual', texto: '80%' },
    ],
  },
  {
    id: 'sp-3', setor: 'TI', seq: 21, tema: 'Liberação de acesso ao ERP para novos compradores',
    objetivo: 'Criar usuários e perfis de acesso no ERP para os três compradores admitidos este mês.',
    pendencias: '',
    solicitante: 'iara', emissor: 'iara', responsaveis: ['lucas'],
    emissao: -6, prevista: -1, conclusao: -2, recebida: true, percentual: 100, status: 'concluida',
    anexos: ['termo-de-responsabilidade.pdf'],
    eventos: [
      { dia: -6, pessoa: 'iara', tipo: 'criacao' },
      { dia: -5, pessoa: 'karen', tipo: 'recebimento' },
      { dia: -3, pessoa: 'lucas', tipo: 'conclusao' },
      { dia: -2, pessoa: 'iara', tipo: 'validacao' },
    ],
  },
  {
    id: 'sp-4', setor: 'ENG', seq: 5, tema: 'Revisão do projeto elétrico — galpão 3',
    objetivo: 'Revisar o projeto elétrico do galpão 3 para a nova carga de compressores.',
    pendencias: 'Memorial de cálculo da carga instalada.',
    solicitante: 'joao', emissor: 'joao', responsaveis: ['elisa'],
    emissao: -9, prevista: 2, recebida: true, percentual: 100, status: 'aguardando_validacao',
    anexos: ['projeto-eletrico-rev02.pdf', 'memorial-carga.pdf'],
    eventos: [
      { dia: -9, pessoa: 'joao', tipo: 'criacao' },
      { dia: -8, pessoa: 'fabio', tipo: 'recebimento' },
      { dia: -1, pessoa: 'elisa', tipo: 'conclusao', texto: 'Revisão 02 anexada com o memorial.' },
    ],
  },
  {
    id: 'sp-5', setor: 'RH', seq: 11, tema: 'Treinamento de NR-35 para a equipe de manutenção',
    objetivo: 'Agendar e realizar a reciclagem de NR-35 (trabalho em altura) para 14 colaboradores.',
    pendencias: 'Confirmação de turma pela empresa de treinamento.',
    solicitante: 'fabio', emissor: 'fabio', responsaveis: ['iara'],
    emissao: -4, prevista: 0, recebida: true, percentual: 40, status: 'aguardando_resposta',
    anexos: [],
    eventos: [
      { dia: -4, pessoa: 'fabio', tipo: 'criacao' },
      { dia: -4, pessoa: 'iara', tipo: 'recebimento' },
      { dia: -1, pessoa: 'iara', tipo: 'resposta', texto: 'Aguardando a empresa confirmar a data da turma.' },
    ],
  },
  {
    id: 'sp-6', setor: 'COM', seq: 17, tema: 'Proposta comercial — cliente Alfa Logística',
    objetivo: 'Elaborar a proposta técnica e comercial para o contrato de 24 meses da Alfa Logística.',
    pendencias: 'Custos de engenharia para composição do preço.',
    solicitante: 'ana', emissor: 'ana', responsaveis: ['diego'],
    emissao: -2, prevista: 9, recebida: false, percentual: 0, status: 'aberta',
    anexos: ['rfp-alfa-logistica.pdf'],
    eventos: [{ dia: -2, pessoa: 'ana', tipo: 'criacao' }],
  },
  {
    id: 'sp-7', setor: 'QP', seq: 3, tema: 'Mapeamento do processo de compras',
    objetivo: 'Mapear o processo atual de compras (AS-IS) e propor o fluxo futuro com alçadas de aprovação.',
    pendencias: '',
    solicitante: 'ana', emissor: 'ana', responsaveis: ['joao'],
    emissao: -30, prevista: -8, conclusao: -10, recebida: true, percentual: 100, status: 'concluida',
    anexos: ['fluxo-compras-to-be.pdf'],
    eventos: [
      { dia: -30, pessoa: 'ana', tipo: 'criacao' },
      { dia: -29, pessoa: 'joao', tipo: 'recebimento' },
      { dia: -11, pessoa: 'joao', tipo: 'conclusao' },
      { dia: -10, pessoa: 'ana', tipo: 'validacao' },
    ],
  },
  {
    id: 'sp-8', setor: 'ADM', seq: 9, tema: 'Renovação do contrato de limpeza predial',
    objetivo: 'Cotar ao menos três fornecedores e renovar o contrato de limpeza que vence no fim do mês.',
    pendencias: 'Terceira cotação.',
    solicitante: 'gabriela', emissor: 'ana', responsaveis: ['ana'],
    emissao: -15, prevista: -5, recebida: true, percentual: 65, status: 'em_andamento',
    anexos: ['cotacao-1.pdf', 'cotacao-2.pdf'],
    prorrogacao: { dias: 7, motivo: 'Um dos fornecedores pediu prazo para a visita técnica.', situacao: 'pendente' },
    eventos: [
      { dia: -15, pessoa: 'gabriela', tipo: 'criacao' },
      { dia: -14, pessoa: 'ana', tipo: 'recebimento' },
      { dia: -6, pessoa: 'ana', tipo: 'percentual', texto: '65%' },
      { dia: -5, pessoa: 'ana', tipo: 'prazo_solicitado', texto: '+7 dias' },
    ],
  },
  {
    id: 'sp-9', setor: 'TI', seq: 22, tema: 'Backup do servidor de arquivos em nuvem',
    objetivo: 'Configurar a rotina de backup diário do servidor de arquivos para armazenamento em nuvem.',
    pendencias: '',
    solicitante: 'gabriela', emissor: 'gabriela', responsaveis: ['karen', 'lucas'],
    emissao: -7, prevista: 12, recebida: true, percentual: 30, status: 'em_andamento',
    anexos: [],
    eventos: [
      { dia: -7, pessoa: 'gabriela', tipo: 'criacao' },
      { dia: -6, pessoa: 'karen', tipo: 'recebimento' },
      { dia: -2, pessoa: 'lucas', tipo: 'percentual', texto: '30%' },
    ],
  },
  {
    id: 'sp-10', setor: 'MKT', seq: 9, tema: 'Atualização do catálogo de produtos',
    objetivo: 'Atualizar fotos, especificações e preços sugeridos do catálogo digital.',
    pendencias: '',
    solicitante: 'diego', emissor: 'diego', responsaveis: ['bruno'],
    emissao: -40, prevista: -20, conclusao: -16, recebida: true, percentual: 100, status: 'concluida',
    anexos: ['catalogo-2026-v3.pdf'],
    eventos: [
      { dia: -40, pessoa: 'diego', tipo: 'criacao' },
      { dia: -39, pessoa: 'bruno', tipo: 'recebimento' },
      { dia: -17, pessoa: 'bruno', tipo: 'conclusao' },
      { dia: -16, pessoa: 'diego', tipo: 'validacao' },
    ],
  },
  {
    id: 'sp-11', setor: 'FIN', seq: 15, tema: 'Previsão de fluxo de caixa do 4º trimestre',
    objetivo: 'Consolidar a previsão de entradas e saídas de outubro a dezembro, por centro de custo.',
    pendencias: 'Previsão de recebimentos do Comercial.',
    solicitante: 'ana', emissor: 'ana', responsaveis: ['gabriela'],
    emissao: -3, prevista: 4, recebida: true, percentual: 20, status: 'em_andamento',
    anexos: [],
    eventos: [
      { dia: -3, pessoa: 'ana', tipo: 'criacao' },
      { dia: -3, pessoa: 'gabriela', tipo: 'recebimento' },
    ],
  },
  {
    id: 'sp-12', setor: 'ENG', seq: 6, tema: 'Laudo de estanqueidade dos reservatórios',
    objetivo: 'Contratar e acompanhar o laudo anual de estanqueidade dos reservatórios de água.',
    pendencias: '',
    solicitante: 'joao', emissor: 'joao', responsaveis: ['fabio'],
    emissao: -1, prevista: 20, recebida: false, percentual: 0, status: 'aberta',
    anexos: [],
    eventos: [{ dia: -1, pessoa: 'joao', tipo: 'criacao' }],
  },
  {
    id: 'sp-13', setor: 'RH', seq: 12, tema: 'Pesquisa de clima organizacional',
    objetivo: 'Aplicar a pesquisa anual de clima e apresentar os resultados por área à diretoria.',
    pendencias: '',
    solicitante: 'ana', emissor: 'ana', responsaveis: ['iara'],
    emissao: -45, prevista: -15, conclusao: -16, recebida: true, percentual: 100, status: 'concluida',
    anexos: ['resultado-pesquisa-clima.pdf'],
    eventos: [
      { dia: -45, pessoa: 'ana', tipo: 'criacao' },
      { dia: -44, pessoa: 'iara', tipo: 'recebimento' },
      { dia: -17, pessoa: 'iara', tipo: 'conclusao' },
      { dia: -16, pessoa: 'ana', tipo: 'validacao' },
    ],
  },
  {
    id: 'sp-14', setor: 'COM', seq: 18, tema: 'Revisão da tabela de preços regional',
    objetivo: 'Revisar a tabela de preços das praças Sul e Sudeste com base no novo custo logístico.',
    pendencias: 'Custos de frete atualizados.',
    solicitante: 'gabriela', emissor: 'gabriela', responsaveis: ['diego'],
    emissao: -20, prevista: -9, recebida: true, percentual: 45, status: 'em_andamento',
    anexos: ['tabela-precos-atual.xlsx'],
    eventos: [
      { dia: -20, pessoa: 'gabriela', tipo: 'criacao' },
      { dia: -19, pessoa: 'diego', tipo: 'recebimento' },
      { dia: -12, pessoa: 'diego', tipo: 'percentual', texto: '45%' },
    ],
  },
  {
    id: 'sp-15', setor: 'QP', seq: 4, tema: 'Auditoria interna ISO 9001',
    objetivo: 'Conduzir a auditoria interna do sistema de gestão da qualidade antes da auditoria externa.',
    pendencias: '',
    solicitante: 'ana', emissor: 'ana', responsaveis: ['joao'],
    emissao: -5, prevista: 25, recebida: true, percentual: 10, status: 'em_andamento',
    anexos: ['plano-auditoria.pdf'],
    eventos: [
      { dia: -5, pessoa: 'ana', tipo: 'criacao' },
      { dia: -5, pessoa: 'joao', tipo: 'recebimento' },
    ],
  },
  {
    id: 'sp-16', setor: 'ADM', seq: 10, tema: 'Reforma da sala de reuniões',
    objetivo: 'Orçar a reforma da sala de reuniões do 2º andar.',
    pendencias: '',
    solicitante: 'bruno', emissor: 'bruno', responsaveis: ['ana'],
    emissao: -25, prevista: -10, recebida: true, percentual: 0, status: 'cancelada',
    anexos: [],
    eventos: [
      { dia: -25, pessoa: 'bruno', tipo: 'criacao' },
      { dia: -24, pessoa: 'ana', tipo: 'recebimento' },
      { dia: -18, pessoa: 'bruno', tipo: 'cancelamento', texto: 'Reforma adiada para o próximo exercício.' },
    ],
  },
  {
    id: 'sp-17', setor: 'MKT', seq: 10, tema: 'Material para feira setorial',
    objetivo: 'Produzir banners, folders e o vídeo institucional para o estande da feira de novembro.',
    pendencias: 'Definição do layout do estande.',
    solicitante: 'diego', emissor: 'diego', responsaveis: ['carla', 'bruno'],
    emissao: -8, prevista: 15, recebida: true, percentual: 0, status: 'aberta',
    anexos: ['planta-estande.pdf'],
    eventos: [
      { dia: -8, pessoa: 'diego', tipo: 'criacao' },
      { dia: -7, pessoa: 'bruno', tipo: 'recebimento' },
    ],
  },
  {
    id: 'sp-18', setor: 'TI', seq: 23, tema: 'Substituição dos notebooks do Financeiro',
    objetivo: 'Especificar, cotar e substituir 6 notebooks do Financeiro com garantia vencida.',
    pendencias: '',
    solicitante: 'gabriela', emissor: 'gabriela', responsaveis: ['karen'],
    emissao: -14, prevista: 3, recebida: true, percentual: 100, status: 'aguardando_validacao',
    anexos: ['especificacao-notebooks.pdf', 'nf-entrega.pdf'],
    eventos: [
      { dia: -14, pessoa: 'gabriela', tipo: 'criacao' },
      { dia: -13, pessoa: 'karen', tipo: 'recebimento' },
      { dia: -1, pessoa: 'karen', tipo: 'conclusao', texto: 'Equipamentos entregues e configurados.' },
    ],
  },
  {
    id: 'sp-19', setor: 'FIN', seq: 16, tema: 'Renegociação de prazo com fornecedor de aço',
    objetivo: 'Negociar a ampliação do prazo de pagamento de 30 para 45 dias.',
    pendencias: '',
    solicitante: 'fabio', emissor: 'fabio', responsaveis: ['gabriela'],
    emissao: -35, prevista: -14, conclusao: -11, recebida: true, percentual: 100, status: 'concluida',
    anexos: ['aditivo-prazo-pagamento.pdf'],
    eventos: [
      { dia: -35, pessoa: 'fabio', tipo: 'criacao' },
      { dia: -34, pessoa: 'gabriela', tipo: 'recebimento' },
      { dia: -12, pessoa: 'gabriela', tipo: 'conclusao' },
      { dia: -11, pessoa: 'fabio', tipo: 'reabertura', texto: 'Faltou o aditivo assinado.' },
      { dia: -11, pessoa: 'gabriela', tipo: 'anexo', texto: 'aditivo-prazo-pagamento.pdf' },
      { dia: -11, pessoa: 'fabio', tipo: 'validacao' },
    ],
  },
  {
    id: 'sp-20', setor: 'ENG', seq: 7, tema: 'Plano de manutenção preventiva das empilhadeiras',
    objetivo: 'Elaborar o plano anual de manutenção preventiva da frota de 8 empilhadeiras.',
    pendencias: '',
    solicitante: 'ana', emissor: 'ana', responsaveis: ['fabio', 'elisa'],
    emissao: -10, prevista: 1, recebida: true, percentual: 70, status: 'em_andamento',
    anexos: ['inventario-frota.xlsx'],
    prorrogacao: { dias: 5, motivo: 'Aguardando o histórico de manutenção do fornecedor.', situacao: 'aprovada' },
    eventos: [
      { dia: -10, pessoa: 'ana', tipo: 'criacao' },
      { dia: -9, pessoa: 'fabio', tipo: 'recebimento' },
      { dia: -4, pessoa: 'fabio', tipo: 'prazo_solicitado', texto: '+5 dias' },
      { dia: -4, pessoa: 'ana', tipo: 'prazo_aprovado' },
      { dia: -2, pessoa: 'elisa', tipo: 'percentual', texto: '70%' },
    ],
  },
  {
    id: 'sp-21', setor: 'RH', seq: 13, tema: 'Admissão de dois compradores',
    objetivo: 'Conduzir o processo seletivo e a admissão de dois compradores plenos.',
    pendencias: '',
    solicitante: 'gabriela', emissor: 'gabriela', responsaveis: ['iara'],
    emissao: -22, prevista: -2, recebida: true, percentual: 90, status: 'em_andamento',
    anexos: ['descricao-vaga-comprador.pdf'],
    eventos: [
      { dia: -22, pessoa: 'gabriela', tipo: 'criacao' },
      { dia: -21, pessoa: 'iara', tipo: 'recebimento' },
      { dia: -4, pessoa: 'iara', tipo: 'percentual', texto: '90%' },
    ],
  },
  {
    id: 'sp-22', setor: 'QP', seq: 5, tema: 'Indicadores de não conformidade do trimestre',
    objetivo: 'Consolidar as não conformidades abertas no trimestre e as ações corretivas.',
    pendencias: '',
    solicitante: 'ana', emissor: 'ana', responsaveis: ['joao'],
    emissao: -28, prevista: -7, conclusao: -8, recebida: true, percentual: 100, status: 'concluida',
    anexos: ['relatorio-nc-t3.pdf'],
    eventos: [
      { dia: -28, pessoa: 'ana', tipo: 'criacao' },
      { dia: -27, pessoa: 'joao', tipo: 'recebimento' },
      { dia: -9, pessoa: 'joao', tipo: 'conclusao' },
      { dia: -8, pessoa: 'ana', tipo: 'validacao' },
    ],
  },
];

/** Resolve os exemplos para datas reais a partir de `now`. */
export function montarDemandasExemplo(now: Date): Sp[] {
  const ano = now.getFullYear();
  return SPS_EXEMPLO.map(({ emissao, prevista, conclusao, eventos, ...sp }) => ({
    ...sp,
    codigo: formatarCodigo(PREFIXO_SP, sp.setor, sp.seq, ano),
    dataEmissao: isoDia(now, emissao),
    dataPrevista: isoDia(now, prevista),
    dataConclusao: conclusao === undefined ? null : isoDia(now, conclusao),
    eventos: eventos.map(({ dia, ...e }) => ({ ...e, data: isoDia(now, dia) })),
  }));
}

export function pessoaPorId(id: string): Pessoa | undefined {
  return PESSOAS.find((p) => p.id === id);
}

export function setorPorSlug(slug: string): Setor | undefined {
  return SETORES.find((s) => s.slug === slug);
}
