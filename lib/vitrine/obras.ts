// Vitrine "Gestão de Obras" (sub-projeto 68) — gestão de obras públicas:
// contrato com o órgão → obras → planilha orçamentária → boletins de medição
// (BM) → planejamento por quinzena. Modelo inspirado no sistema de origem
// (tipos Contrato/Obra/Servico/Medicao), reduzido ao que a demonstração mostra.
// Tudo puro e em memória; a demo nunca grava nada.
//
// Meses e datas dos exemplos são DESLOCAMENTOS a partir de `now`, para que o
// gráfico de "últimos 6 meses" e os prazos continuem coerentes em qualquer dia.

export type TipoContrato = 'ESTADO' | 'PREFEITURA';
export type StatusObra = 'ATIVA' | 'CONCLUIDA' | 'SUSPENSA';
export type StatusMedicao = 'RASCUNHO' | 'ENVIADA' | 'APROVADA';

export const STATUS_OBRA_LABEL: Record<StatusObra, string> = {
  ATIVA: 'Em execução',
  CONCLUIDA: 'Concluída',
  SUSPENSA: 'Suspensa',
};

export const STATUS_MEDICAO_LABEL: Record<StatusMedicao, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADA: 'Enviada ao órgão',
  APROVADA: 'Aprovada',
};

export type Contrato = {
  id: string;
  numero: string;
  objeto: string;
  tipo: TipoContrato;
  orgao: string;
  orgaoSubdivisao: string;
  cidade: string;
  uf: string;
  /** Frações (0.245 = 24,5%). */
  bdi: number;
  desconto: number;
};

export type Servico = {
  item: string;
  grupo: string;
  fonte: 'SINAPI' | 'SICRO' | 'Própria';
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  /** Preço unitário de referência, sem BDI e sem desconto. */
  precoUnitario: number;
};

export type GrupoServico = { item: string; descricao: string };

export type MedicaoExemplo = {
  numero: number;
  /** Mês de referência relativo ao mês de `now` (0 = mês atual). */
  mes: number;
  status: StatusMedicao;
  /** Fração da quantidade contratada medida neste BM, por grupo da planilha. */
  avanco: Record<string, number>;
};

export type ColunaKanban = 'planejado' | 'em_execucao' | 'conferencia' | 'concluido';

export const COLUNAS_KANBAN: { id: ColunaKanban; label: string }[] = [
  { id: 'planejado', label: 'Planejado' },
  { id: 'em_execucao', label: 'Em execução' },
  { id: 'conferencia', label: 'Conferência' },
  { id: 'concluido', label: 'Concluído' },
];

export type TarefaKanban = {
  id: string;
  titulo: string;
  servico: string;
  coluna: ColunaKanban;
  quinzena: 1 | 2;
  responsavel: string;
};

export type Obra = {
  id: string;
  contratoId: string;
  nome: string;
  local: string;
  status: StatusObra;
  engenheiro: string;
  /** Mês da ordem de serviço relativo a `now`. */
  mesOrdemServico: number;
  prazoDias: number;
  grupos: GrupoServico[];
  servicos: Servico[];
  medicoes: MedicaoExemplo[];
  kanban: TarefaKanban[];
};

// ─── Datas ────────────────────────────────────────────────────────────────

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Primeiro dia do mês `now + deslocamento`. */
export function inicioDoMes(now: Date, deslocamento: number): Date {
  return new Date(now.getFullYear(), now.getMonth() + deslocamento, 1);
}

export function rotuloMes(now: Date, deslocamento: number): string {
  const d = inicioDoMes(now, deslocamento);
  return `${MESES_CURTOS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

function formatarDataBr(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ─── Cálculos ─────────────────────────────────────────────────────────────

const arred2 = (n: number) => Math.round(n * 100) / 100;

/** Preço unitário final: referência + BDI, menos o desconto da licitação. */
export function precoUnitarioFinal(precoReferencia: number, bdi: number, desconto: number): number {
  return arred2(precoReferencia * (1 + bdi) * (1 - desconto));
}

export function valorServico(servico: Servico, contrato: Contrato): number {
  return arred2(servico.quantidade * precoUnitarioFinal(servico.precoUnitario, contrato.bdi, contrato.desconto));
}

export function valorPlanilha(obra: Obra, contrato: Contrato): number {
  return arred2(obra.servicos.reduce((soma, s) => soma + valorServico(s, contrato), 0));
}

export function valorPorGrupo(obra: Obra, contrato: Contrato): { grupo: GrupoServico; valor: number }[] {
  return obra.grupos.map((grupo) => ({
    grupo,
    valor: arred2(
      obra.servicos.filter((s) => s.grupo === grupo.item).reduce((soma, s) => soma + valorServico(s, contrato), 0),
    ),
  }));
}

export type LinhaMedicao = {
  servico: Servico;
  quantidadeAnterior: number;
  quantidadeMedicao: number;
  quantidadeAcumulada: number;
  /** Acumulado / contratado, 0–100. */
  percentualAcumulado: number;
  valorMedicao: number;
};

/** Quantidades do BM `numero`: anterior (BMs antes dele), desta medição e acumulado. */
export function linhasDaMedicao(obra: Obra, contrato: Contrato, numero: number): LinhaMedicao[] {
  const medicao = obra.medicoes.find((m) => m.numero === numero);
  if (!medicao) return [];
  const anteriores = obra.medicoes.filter((m) => m.numero < numero);

  return obra.servicos.map((servico) => {
    const fracaoAnterior = anteriores.reduce((soma, m) => soma + (m.avanco[servico.grupo] ?? 0), 0);
    const fracaoAtual = medicao.avanco[servico.grupo] ?? 0;
    const quantidadeAnterior = arred2(servico.quantidade * fracaoAnterior);
    const quantidadeMedicao = arred2(servico.quantidade * fracaoAtual);
    const quantidadeAcumulada = arred2(quantidadeAnterior + quantidadeMedicao);
    return {
      servico,
      quantidadeAnterior,
      quantidadeMedicao,
      quantidadeAcumulada,
      percentualAcumulado: servico.quantidade ? Math.round((quantidadeAcumulada / servico.quantidade) * 1000) / 10 : 0,
      valorMedicao: arred2(quantidadeMedicao * precoUnitarioFinal(servico.precoUnitario, contrato.bdi, contrato.desconto)),
    };
  });
}

export function valorDaMedicao(obra: Obra, contrato: Contrato, numero: number): number {
  return arred2(linhasDaMedicao(obra, contrato, numero).reduce((soma, l) => soma + l.valorMedicao, 0));
}

/** Rascunho não conta: só o que já foi enviado ao órgão ou aprovado. */
export function medicaoConta(status: StatusMedicao): boolean {
  return status !== 'RASCUNHO';
}

export type ResumoObra = {
  valorContratado: number;
  valorMedido: number;
  saldo: number;
  /** Medido / contratado, 0–100. */
  avanco: number;
  terminoPrevisto: string;
  /** Dias até o término previsto (negativo = vencido). Null em obra concluída. */
  diasRestantes: number | null;
};

export function resumoDaObra(obra: Obra, contrato: Contrato, now: Date): ResumoObra {
  const valorContratado = valorPlanilha(obra, contrato);
  const valorMedido = arred2(
    obra.medicoes.filter((m) => medicaoConta(m.status)).reduce((soma, m) => soma + valorDaMedicao(obra, contrato, m.numero), 0),
  );
  const inicio = inicioDoMes(now, obra.mesOrdemServico);
  inicio.setDate(5);
  const termino = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + obra.prazoDias);
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return {
    valorContratado,
    valorMedido,
    saldo: arred2(valorContratado - valorMedido),
    avanco: valorContratado ? Math.round((valorMedido / valorContratado) * 1000) / 10 : 0,
    terminoPrevisto: formatarDataBr(termino),
    diasRestantes: obra.status === 'CONCLUIDA' ? null : Math.round((termino.getTime() - hoje.getTime()) / 86_400_000),
  };
}

export type IndicadoresObras = {
  contratosAtivos: number;
  obrasEmExecucao: number;
  valorContratado: number;
  valorMedido: number;
  saldoAMedir: number;
  avanco: number;
  /** Valor em BMs enviados ao órgão e ainda não aprovados. */
  aguardandoAprovacao: number;
};

export function indicadoresCockpit(obras: Obra[], contratos: Contrato[], now: Date): IndicadoresObras {
  const contratoDe = (o: Obra) => contratos.find((c) => c.id === o.contratoId)!;
  const resumos = obras.map((o) => resumoDaObra(o, contratoDe(o), now));
  const valorContratado = arred2(resumos.reduce((s, r) => s + r.valorContratado, 0));
  const valorMedido = arred2(resumos.reduce((s, r) => s + r.valorMedido, 0));
  const aguardandoAprovacao = arred2(
    obras.reduce(
      (soma, o) =>
        soma +
        o.medicoes.filter((m) => m.status === 'ENVIADA').reduce((s, m) => s + valorDaMedicao(o, contratoDe(o), m.numero), 0),
      0,
    ),
  );
  const contratosComObraAtiva = new Set(obras.filter((o) => o.status === 'ATIVA').map((o) => o.contratoId));

  return {
    contratosAtivos: contratosComObraAtiva.size,
    obrasEmExecucao: obras.filter((o) => o.status === 'ATIVA').length,
    valorContratado,
    valorMedido,
    saldoAMedir: arred2(valorContratado - valorMedido),
    avanco: valorContratado ? Math.round((valorMedido / valorContratado) * 1000) / 10 : 0,
    aguardandoAprovacao,
  };
}

/** Valor medido (BMs enviados + aprovados) por mês, nos últimos `meses` meses. */
export function medidoPorMes(
  obras: Obra[],
  contratos: Contrato[],
  now: Date,
  meses = 6,
): { rotulo: string; valor: number }[] {
  const serie: { rotulo: string; valor: number }[] = [];
  for (let desloc = -(meses - 1); desloc <= 0; desloc++) {
    let valor = 0;
    for (const obra of obras) {
      const contrato = contratos.find((c) => c.id === obra.contratoId)!;
      for (const m of obra.medicoes) {
        if (m.mes === desloc && medicaoConta(m.status)) valor += valorDaMedicao(obra, contrato, m.numero);
      }
    }
    serie.push({ rotulo: rotuloMes(now, desloc), valor: arred2(valor) });
  }
  return serie;
}

// ─── Dados de exemplo ─────────────────────────────────────────────────────

type ModeloPlanilha = { grupos: GrupoServico[]; servicos: Servico[] };

function escalar(modelo: ModeloPlanilha, fator: number): ModeloPlanilha {
  return {
    grupos: modelo.grupos,
    servicos: modelo.servicos.map((s) => ({
      ...s,
      // Verba ("vb") é global, não escala com o tamanho da obra.
      quantidade: s.unidade === 'vb' ? s.quantidade : Math.round(s.quantidade * fator),
    })),
  };
}

const PLANILHA_PAVIMENTACAO: ModeloPlanilha = {
  grupos: [
    { item: '1', descricao: 'Serviços preliminares' },
    { item: '2', descricao: 'Terraplenagem' },
    { item: '3', descricao: 'Pavimentação' },
    { item: '4', descricao: 'Drenagem' },
  ],
  servicos: [
    { item: '1.1', grupo: '1', fonte: 'SINAPI', codigo: '103689', descricao: 'Placa de obra em chapa de aço galvanizado', unidade: 'm²', quantidade: 6, precoUnitario: 450 },
    { item: '1.2', grupo: '1', fonte: 'SINAPI', codigo: '99059', descricao: 'Locação topográfica de eixo de via', unidade: 'm', quantidade: 6000, precoUnitario: 4.85 },
    { item: '2.1', grupo: '2', fonte: 'SICRO', codigo: '5502978', descricao: 'Escavação, carga e transporte de material de 1ª categoria', unidade: 'm³', quantidade: 18500, precoUnitario: 12.4 },
    { item: '2.2', grupo: '2', fonte: 'SICRO', codigo: '5502113', descricao: 'Compactação de aterros a 100% do Proctor normal', unidade: 'm³', quantidade: 9200, precoUnitario: 6.9 },
    { item: '3.1', grupo: '3', fonte: 'SICRO', codigo: '4011209', descricao: 'Sub-base de solo estabilizado granulometricamente', unidade: 'm³', quantidade: 5400, precoUnitario: 68.3 },
    { item: '3.2', grupo: '3', fonte: 'SICRO', codigo: '4011276', descricao: 'Base de brita graduada simples', unidade: 'm³', quantidade: 4300, precoUnitario: 142.5 },
    { item: '3.3', grupo: '3', fonte: 'SICRO', codigo: '4011353', descricao: 'Imprimação com emulsão asfáltica', unidade: 'm²', quantidade: 28000, precoUnitario: 6.1 },
    { item: '3.4', grupo: '3', fonte: 'SICRO', codigo: '4011463', descricao: 'Concreto betuminoso usinado a quente (CBUQ) — faixa C', unidade: 't', quantidade: 3900, precoUnitario: 485 },
    { item: '4.1', grupo: '4', fonte: 'SINAPI', codigo: '92210', descricao: 'Tubo de concreto armado DN 600 mm, assentado', unidade: 'm', quantidade: 820, precoUnitario: 395 },
    { item: '4.2', grupo: '4', fonte: 'Própria', codigo: 'CP-014', descricao: 'Boca de lobo em alvenaria com grelha de concreto', unidade: 'un', quantidade: 46, precoUnitario: 2150 },
  ],
};

const PLANILHA_UBS: ModeloPlanilha = {
  grupos: [
    { item: '1', descricao: 'Serviços preliminares' },
    { item: '2', descricao: 'Fundações' },
    { item: '3', descricao: 'Estrutura' },
    { item: '4', descricao: 'Alvenaria e vedação' },
    { item: '5', descricao: 'Instalações' },
    { item: '6', descricao: 'Acabamentos' },
  ],
  servicos: [
    { item: '1.1', grupo: '1', fonte: 'SINAPI', codigo: '103689', descricao: 'Placa de obra em chapa de aço galvanizado', unidade: 'm²', quantidade: 6, precoUnitario: 450 },
    { item: '1.2', grupo: '1', fonte: 'Própria', codigo: 'CP-002', descricao: 'Instalações provisórias de canteiro', unidade: 'vb', quantidade: 1, precoUnitario: 38500 },
    { item: '2.1', grupo: '2', fonte: 'SINAPI', codigo: '100897', descricao: 'Estaca escavada mecanicamente, Ø 30 cm', unidade: 'm', quantidade: 640, precoUnitario: 118 },
    { item: '2.2', grupo: '2', fonte: 'SINAPI', codigo: '96557', descricao: 'Concreto fck 30 MPa para blocos e vigas baldrame', unidade: 'm³', quantidade: 96, precoUnitario: 690 },
    { item: '3.1', grupo: '3', fonte: 'SINAPI', codigo: '103674', descricao: 'Concreto fck 30 MPa para pilares, vigas e lajes', unidade: 'm³', quantidade: 180, precoUnitario: 720 },
    { item: '3.2', grupo: '3', fonte: 'SINAPI', codigo: '92778', descricao: 'Armação em aço CA-50', unidade: 'kg', quantidade: 14500, precoUnitario: 11.4 },
    { item: '4.1', grupo: '4', fonte: 'SINAPI', codigo: '103324', descricao: 'Alvenaria de vedação com bloco cerâmico de 14 cm', unidade: 'm²', quantidade: 1650, precoUnitario: 98 },
    { item: '5.1', grupo: '5', fonte: 'Própria', codigo: 'CP-031', descricao: 'Instalações elétricas, lógica e SPDA', unidade: 'vb', quantidade: 1, precoUnitario: 186000 },
    { item: '5.2', grupo: '5', fonte: 'Própria', codigo: 'CP-032', descricao: 'Instalações hidrossanitárias e gases medicinais', unidade: 'vb', quantidade: 1, precoUnitario: 142000 },
    { item: '6.1', grupo: '6', fonte: 'SINAPI', codigo: '98680', descricao: 'Piso vinílico hospitalar em manta', unidade: 'm²', quantidade: 620, precoUnitario: 189 },
    { item: '6.2', grupo: '6', fonte: 'SINAPI', codigo: '88489', descricao: 'Pintura acrílica em paredes, duas demãos', unidade: 'm²', quantidade: 3900, precoUnitario: 24.5 },
  ],
};

const PLANILHA_ESCOLA: ModeloPlanilha = {
  grupos: [
    { item: '1', descricao: 'Demolições e retiradas' },
    { item: '2', descricao: 'Cobertura' },
    { item: '3', descricao: 'Esquadrias' },
    { item: '4', descricao: 'Instalações elétricas' },
    { item: '5', descricao: 'Acabamentos' },
  ],
  servicos: [
    { item: '1.1', grupo: '1', fonte: 'SINAPI', codigo: '97633', descricao: 'Demolição de revestimento cerâmico', unidade: 'm²', quantidade: 900, precoUnitario: 18.5 },
    { item: '1.2', grupo: '1', fonte: 'SINAPI', codigo: '97644', descricao: 'Retirada de esquadrias', unidade: 'un', quantidade: 64, precoUnitario: 42 },
    { item: '2.1', grupo: '2', fonte: 'SINAPI', codigo: '94216', descricao: 'Telhamento com telha metálica termoacústica', unidade: 'm²', quantidade: 1100, precoUnitario: 165 },
    { item: '2.2', grupo: '2', fonte: 'SINAPI', codigo: '94229', descricao: 'Calhas e rufos em chapa galvanizada', unidade: 'm', quantidade: 260, precoUnitario: 95 },
    { item: '3.1', grupo: '3', fonte: 'SINAPI', codigo: '94570', descricao: 'Janela de alumínio de correr com vidro', unidade: 'm²', quantidade: 180, precoUnitario: 620 },
    { item: '4.1', grupo: '4', fonte: 'Própria', codigo: 'CP-040', descricao: 'Revisão e adequação das instalações elétricas', unidade: 'vb', quantidade: 1, precoUnitario: 68000 },
    { item: '5.1', grupo: '5', fonte: 'SINAPI', codigo: '87265', descricao: 'Revestimento cerâmico em paredes', unidade: 'm²', quantidade: 900, precoUnitario: 78 },
    { item: '5.2', grupo: '5', fonte: 'SINAPI', codigo: '88489', descricao: 'Pintura acrílica em paredes, duas demãos', unidade: 'm²', quantidade: 4200, precoUnitario: 22 },
  ],
};

export const CONTRATOS: Contrato[] = [
  {
    id: 'ct-1',
    numero: '045/2025',
    objeto: 'Pavimentação e drenagem da Rodovia Estadual RJ-142',
    tipo: 'ESTADO',
    orgao: 'Secretaria de Estado de Infraestrutura',
    orgaoSubdivisao: 'Departamento de Estradas de Rodagem',
    cidade: 'Nova Friburgo',
    uf: 'RJ',
    bdi: 0.245,
    desconto: 0.032,
  },
  {
    id: 'ct-2',
    numero: '112/2025',
    objeto: 'Construção de duas Unidades Básicas de Saúde',
    tipo: 'PREFEITURA',
    orgao: 'Prefeitura Municipal de Nova Esperança',
    orgaoSubdivisao: 'Secretaria Municipal de Saúde',
    cidade: 'Nova Esperança',
    uf: 'RJ',
    bdi: 0.228,
    desconto: 0.05,
  },
  {
    id: 'ct-3',
    numero: '019/2025',
    objeto: 'Reforma e modernização de escolas municipais',
    tipo: 'PREFEITURA',
    orgao: 'Prefeitura Municipal de Rio Claro',
    orgaoSubdivisao: 'Secretaria Municipal de Educação',
    cidade: 'Rio Claro',
    uf: 'RJ',
    bdi: 0.22,
    desconto: 0.041,
  },
];

export const OBRAS: Obra[] = [
  {
    id: 'ob-1',
    contratoId: 'ct-1',
    nome: 'RJ-142 — trecho 1 (km 0 ao km 6)',
    local: 'Nova Friburgo / RJ',
    status: 'ATIVA',
    engenheiro: 'Eng. Marcos Vieira',
    mesOrdemServico: -7,
    prazoDias: 420,
    ...PLANILHA_PAVIMENTACAO,
    medicoes: [
      { numero: 1, mes: -6, status: 'APROVADA', avanco: { '1': 0.9, '2': 0.25 } },
      { numero: 2, mes: -5, status: 'APROVADA', avanco: { '1': 0.1, '2': 0.35, '3': 0.05 } },
      { numero: 3, mes: -4, status: 'APROVADA', avanco: { '2': 0.3, '3': 0.15, '4': 0.1 } },
      { numero: 4, mes: -3, status: 'APROVADA', avanco: { '2': 0.1, '3': 0.2, '4': 0.2 } },
      { numero: 5, mes: -2, status: 'APROVADA', avanco: { '3': 0.2, '4': 0.2 } },
      { numero: 6, mes: -1, status: 'ENVIADA', avanco: { '3': 0.12, '4': 0.15 } },
      { numero: 7, mes: 0, status: 'RASCUNHO', avanco: { '3': 0.05, '4': 0.05 } },
    ],
    kanban: [
      { id: 'k1', titulo: 'Aplicação de CBUQ — km 3,2 ao km 4,0', servico: '3.4', coluna: 'em_execucao', quinzena: 1, responsavel: 'Equipe de pavimentação' },
      { id: 'k2', titulo: 'Imprimação — km 4,0 ao km 4,8', servico: '3.3', coluna: 'planejado', quinzena: 1, responsavel: 'Equipe de pavimentação' },
      { id: 'k3', titulo: 'Assentamento de tubos DN 600 — travessia km 2,7', servico: '4.1', coluna: 'conferencia', quinzena: 1, responsavel: 'Equipe de drenagem' },
      { id: 'k4', titulo: 'Bocas de lobo — km 1,5 ao km 2,5 (8 un)', servico: '4.2', coluna: 'concluido', quinzena: 1, responsavel: 'Equipe de drenagem' },
      { id: 'k5', titulo: 'Base de brita graduada — km 4,8 ao km 5,6', servico: '3.2', coluna: 'planejado', quinzena: 2, responsavel: 'Equipe de pavimentação' },
      { id: 'k6', titulo: 'Sub-base — km 5,6 ao km 6,0', servico: '3.1', coluna: 'planejado', quinzena: 2, responsavel: 'Equipe de terraplenagem' },
    ],
  },
  {
    id: 'ob-2',
    contratoId: 'ct-1',
    nome: 'RJ-142 — trecho 2 (km 6 ao km 11)',
    local: 'Nova Friburgo / RJ',
    status: 'ATIVA',
    engenheiro: 'Eng. Marcos Vieira',
    mesOrdemServico: -3,
    prazoDias: 300,
    ...escalar(PLANILHA_PAVIMENTACAO, 0.8),
    medicoes: [
      { numero: 1, mes: -2, status: 'APROVADA', avanco: { '1': 1, '2': 0.3 } },
      { numero: 2, mes: -1, status: 'ENVIADA', avanco: { '2': 0.4, '3': 0.05 } },
      { numero: 3, mes: 0, status: 'RASCUNHO', avanco: { '2': 0.1, '3': 0.08 } },
    ],
    kanban: [
      { id: 'k1', titulo: 'Escavação e transporte — km 9 ao km 10', servico: '2.1', coluna: 'em_execucao', quinzena: 1, responsavel: 'Equipe de terraplenagem' },
      { id: 'k2', titulo: 'Compactação de aterro — km 7 ao km 8', servico: '2.2', coluna: 'conferencia', quinzena: 1, responsavel: 'Equipe de terraplenagem' },
      { id: 'k3', titulo: 'Sub-base — km 6 ao km 7', servico: '3.1', coluna: 'planejado', quinzena: 2, responsavel: 'Equipe de pavimentação' },
    ],
  },
  {
    id: 'ob-3',
    contratoId: 'ct-2',
    nome: 'UBS Jardim das Flores',
    local: 'Rua das Acácias, 410 — Nova Esperança / RJ',
    status: 'ATIVA',
    engenheiro: 'Eng.ª Paula Coutinho',
    mesOrdemServico: -8,
    prazoDias: 360,
    ...PLANILHA_UBS,
    medicoes: [
      { numero: 1, mes: -7, status: 'APROVADA', avanco: { '1': 0.6, '2': 0.5 } },
      { numero: 2, mes: -6, status: 'APROVADA', avanco: { '1': 0.4, '2': 0.5, '3': 0.2 } },
      { numero: 3, mes: -5, status: 'APROVADA', avanco: { '3': 0.35 } },
      { numero: 4, mes: -4, status: 'APROVADA', avanco: { '3': 0.3, '4': 0.3 } },
      { numero: 5, mes: -3, status: 'APROVADA', avanco: { '3': 0.15, '4': 0.4, '5': 0.1 } },
      { numero: 6, mes: -2, status: 'APROVADA', avanco: { '4': 0.3, '5': 0.25 } },
      { numero: 7, mes: -1, status: 'ENVIADA', avanco: { '5': 0.25, '6': 0.15 } },
      { numero: 8, mes: 0, status: 'RASCUNHO', avanco: { '5': 0.1, '6': 0.1 } },
    ],
    kanban: [
      { id: 'k1', titulo: 'Infraestrutura elétrica dos consultórios', servico: '5.1', coluna: 'em_execucao', quinzena: 1, responsavel: 'Instaladora Volt' },
      { id: 'k2', titulo: 'Rede de gases medicinais — ala de procedimentos', servico: '5.2', coluna: 'em_execucao', quinzena: 1, responsavel: 'Equipe hidráulica' },
      { id: 'k3', titulo: 'Pintura — recepção e corredores', servico: '6.2', coluna: 'conferencia', quinzena: 1, responsavel: 'Equipe de acabamento' },
      { id: 'k4', titulo: 'Piso vinílico — sala de vacinação', servico: '6.1', coluna: 'planejado', quinzena: 2, responsavel: 'Equipe de acabamento' },
      { id: 'k5', titulo: 'Pintura — consultórios 1 a 4', servico: '6.2', coluna: 'planejado', quinzena: 2, responsavel: 'Equipe de acabamento' },
    ],
  },
  {
    id: 'ob-4',
    contratoId: 'ct-2',
    nome: 'UBS Vila Nova',
    local: 'Av. Brasil, 1.250 — Nova Esperança / RJ',
    status: 'ATIVA',
    engenheiro: 'Eng.ª Paula Coutinho',
    mesOrdemServico: -2,
    prazoDias: 360,
    ...PLANILHA_UBS,
    medicoes: [
      { numero: 1, mes: -1, status: 'ENVIADA', avanco: { '1': 0.7, '2': 0.3 } },
      { numero: 2, mes: 0, status: 'RASCUNHO', avanco: { '1': 0.3, '2': 0.3 } },
    ],
    kanban: [
      { id: 'k1', titulo: 'Estacas escavadas — eixos A a D', servico: '2.1', coluna: 'em_execucao', quinzena: 1, responsavel: 'Fundações Rocha' },
      { id: 'k2', titulo: 'Blocos e vigas baldrame — eixos A e B', servico: '2.2', coluna: 'planejado', quinzena: 2, responsavel: 'Equipe de estrutura' },
    ],
  },
  {
    id: 'ob-5',
    contratoId: 'ct-3',
    nome: 'E.M. Professora Helena Costa',
    local: 'Rua Sete de Setembro, 88 — Rio Claro / RJ',
    status: 'CONCLUIDA',
    engenheiro: 'Eng. Rafael Antunes',
    mesOrdemServico: -9,
    prazoDias: 210,
    ...PLANILHA_ESCOLA,
    medicoes: [
      { numero: 1, mes: -8, status: 'APROVADA', avanco: { '1': 1, '2': 0.4 } },
      { numero: 2, mes: -7, status: 'APROVADA', avanco: { '2': 0.6, '3': 0.5 } },
      { numero: 3, mes: -6, status: 'APROVADA', avanco: { '3': 0.5, '4': 0.6, '5': 0.3 } },
      { numero: 4, mes: -5, status: 'APROVADA', avanco: { '4': 0.4, '5': 0.7 } },
    ],
    kanban: [],
  },
  {
    id: 'ob-6',
    contratoId: 'ct-3',
    nome: 'E.M. Vereador Antônio Prado',
    local: 'Rua do Comércio, 301 — Rio Claro / RJ',
    status: 'ATIVA',
    engenheiro: 'Eng. Rafael Antunes',
    mesOrdemServico: -4,
    prazoDias: 240,
    ...escalar(PLANILHA_ESCOLA, 1.2),
    medicoes: [
      { numero: 1, mes: -3, status: 'APROVADA', avanco: { '1': 1, '2': 0.2 } },
      { numero: 2, mes: -2, status: 'APROVADA', avanco: { '2': 0.5, '3': 0.3 } },
      { numero: 3, mes: -1, status: 'ENVIADA', avanco: { '2': 0.2, '3': 0.4, '4': 0.3 } },
      { numero: 4, mes: 0, status: 'RASCUNHO', avanco: { '3': 0.1, '4': 0.2 } },
    ],
    kanban: [
      { id: 'k1', titulo: 'Esquadrias — bloco B (salas 5 a 9)', servico: '3.1', coluna: 'em_execucao', quinzena: 1, responsavel: 'Serralheria Prado' },
      { id: 'k2', titulo: 'Quadro geral e circuitos — bloco A', servico: '4.1', coluna: 'conferencia', quinzena: 1, responsavel: 'Equipe elétrica' },
      { id: 'k3', titulo: 'Calhas e rufos — pátio coberto', servico: '2.2', coluna: 'concluido', quinzena: 1, responsavel: 'Equipe de cobertura' },
      { id: 'k4', titulo: 'Revestimento cerâmico — banheiros', servico: '5.1', coluna: 'planejado', quinzena: 2, responsavel: 'Equipe de acabamento' },
    ],
  },
];

/** Obra pelo id; id desconhecido cai na primeira obra da carteira. */
export function obraPorId(id: string): Obra {
  const obra = OBRAS.find((o) => o.id === id) ?? OBRAS[0];
  if (!obra) throw new Error('vitrine de obras sem obras de exemplo');
  return obra;
}

export const OBRA_INICIAL_ID = obraPorId('').id;

export function contratoPorId(id: string): Contrato | undefined {
  return CONTRATOS.find((c) => c.id === id);
}

export function obrasDoContrato(contratoId: string): Obra[] {
  return OBRAS.filter((o) => o.contratoId === contratoId);
}
