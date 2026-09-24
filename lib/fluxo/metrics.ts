import { FLUXO_STAGES, type FluxoStageId } from './stages';
import type { FluxoEtapa, FluxoProcesso } from './types';

// Painel de gestão dos processos de compra.
//
// Pedido de cliente (24/09/2026): "não vi um assistente para gestão de
// processos de compras, com dashboards de atendimentos, SLA e etc".
//
// Tudo aqui é PURO: recebe os processos e as execuções de etapa e devolve os
// números. Sem banco, sem data implícita — `agora` entra por parâmetro, senão
// o teste muda de resultado conforme o dia.

const DIA_MS = 24 * 60 * 60 * 1000;

/** A partir de quantos dias sem avançar uma compra conta como parada. */
export const DIAS_PARA_ALERTA = 3;

/** Prazo aceitável por etapa, em horas. 0 ou ausente = etapa sem meta. */
export type SlaPorEtapa = Partial<Record<FluxoStageId, number>>;

export type EtapaMetrica = {
  etapa: FluxoStageId;
  num: number;
  label: string;
  /** Processos parados nesta etapa agora. */
  emAndamento: number;
  /** Quantas vezes a etapa foi aprovada (SIGA). */
  aprovacoes: number;
  /** Quantas vezes foi devolvida para refazer (AJUSTAR). */
  ajustes: number;
  /** % de execuções que precisaram de correção. */
  retrabalhoPct: number;
  /** Horas médias entre a IA executar e o comprador decidir. */
  horasAteDecisao: number | null;

  /** Meta definida pelo cliente, em horas. null = etapa sem meta. */
  metaHoras: number | null;
  /** % de decisões dentro da meta. null quando não há meta ou decisão. */
  dentroDaMetaPct: number | null;
  /** Quantas decisões estouraram a meta. */
  estouros: number;
};

export type ProcessoParado = {
  id: string;
  titulo: string;
  etapa: FluxoStageId;
  etapaLabel: string;
  diasParado: number;
  /** true = a IA já respondeu e está esperando decisão humana. */
  aguardandoDecisao: boolean;
};

export type FluxoPainel = {
  totalProcessos: number;
  emAndamento: number;
  concluidos: number;
  /** Dias médios da abertura até a conclusão (só processos concluídos). */
  cicloMedioDias: number | null;
  /** Compras sem avançar há DIAS_PARA_ALERTA ou mais. */
  parados: ProcessoParado[];
  /** Compras abertas que JÁ passaram da meta da etapa em que estão. */
  foraDoPrazo: ProcessoParado[];
  /** Quantas decisões esperam o comprador agora. */
  aguardandoDecisao: number;
  etapas: EtapaMetrica[];
};

function horas(ms: number): number {
  return Math.round((ms / (60 * 60 * 1000)) * 10) / 10;
}

function dias(ms: number): number {
  return Math.floor(ms / DIA_MS);
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const soma = valores.reduce((a, b) => a + b, 0);
  return Math.round((soma / valores.length) * 10) / 10;
}

/** Última vez que alguma coisa aconteceu no processo. */
function ultimaAtividade(processo: FluxoProcesso, etapas: FluxoEtapa[]): number {
  const marcos = [
    new Date(processo.updated_at).getTime(),
    new Date(processo.created_at).getTime(),
    ...etapas.flatMap((e) => [
      new Date(e.created_at).getTime(),
      e.decidida_em ? new Date(e.decidida_em).getTime() : 0,
    ]),
  ].filter((t) => Number.isFinite(t) && t > 0);

  return marcos.length ? Math.max(...marcos) : 0;
}

export function construirPainel(args: {
  processos: FluxoProcesso[];
  etapas: FluxoEtapa[];
  agora: number;
  /** Metas do cliente. Sem elas o painel mede, mas não julga. */
  slas?: SlaPorEtapa;
}): FluxoPainel {
  const { processos, etapas, agora, slas = {} } = args;

  const porProcesso = new Map<string, FluxoEtapa[]>();
  for (const e of etapas) {
    const lista = porProcesso.get(e.processo_id) ?? [];
    lista.push(e);
    porProcesso.set(e.processo_id, lista);
  }

  const emAndamento = processos.filter((p) => p.status === 'em_andamento');
  const concluidos = processos.filter((p) => p.status === 'concluido');

  // Ciclo: só faz sentido em processo que chegou ao fim.
  const ciclos = concluidos
    .map(
      (p) =>
        new Date(p.updated_at).getTime() - new Date(p.created_at).getTime(),
    )
    .filter((ms) => Number.isFinite(ms) && ms >= 0)
    .map((ms) => ms / DIA_MS);

  // --- Por etapa ------------------------------------------------------------

  const metricas: EtapaMetrica[] = FLUXO_STAGES.map((stage) => {
    const daEtapa = etapas.filter((e) => e.etapa === stage.id);
    const decididas = daEtapa.filter((e) => e.decisao !== 'pendente');

    const aprovacoes = daEtapa.filter((e) => e.decisao === 'siga').length;
    const ajustes = daEtapa.filter((e) => e.decisao === 'ajustar').length;

    const esperas = daEtapa
      .filter((e) => e.decidida_em)
      .map(
        (e) =>
          new Date(e.decidida_em!).getTime() - new Date(e.created_at).getTime(),
      )
      .filter((ms) => Number.isFinite(ms) && ms >= 0);

    // Meta: só conta como SLA quando o cliente definiu um prazo > 0.
    const meta = slas[stage.id];
    const metaHoras = meta && meta > 0 ? meta : null;
    const metaMs = metaHoras ? metaHoras * 60 * 60 * 1000 : null;

    const estouros = metaMs
      ? esperas.filter((ms) => ms > metaMs).length
      : 0;

    return {
      etapa: stage.id,
      num: stage.num,
      label: stage.label,
      emAndamento: emAndamento.filter((p) => p.etapa_atual === stage.id).length,
      aprovacoes,
      ajustes,
      retrabalhoPct:
        decididas.length > 0
          ? Math.round((ajustes / decididas.length) * 100)
          : 0,
      horasAteDecisao: esperas.length ? horas(media(esperas) ?? 0) : null,
      metaHoras,
      dentroDaMetaPct:
        metaMs && esperas.length > 0
          ? Math.round(((esperas.length - estouros) / esperas.length) * 100)
          : null,
      estouros,
    };
  });

  // --- Paradas --------------------------------------------------------------

  const parados: ProcessoParado[] = [];
  const foraDoPrazo: ProcessoParado[] = [];
  let aguardando = 0;

  for (const p of emAndamento) {
    const doProcesso = porProcesso.get(p.id) ?? [];
    const pendente = doProcesso.find(
      (e) => e.etapa === p.etapa_atual && e.decisao === 'pendente',
    );
    if (pendente) aguardando++;

    const paradoMs = agora - ultimaAtividade(p, doProcesso);
    const diasParado = dias(paradoMs);

    const stage = FLUXO_STAGES.find((s) => s.id === p.etapa_atual);
    const linha: ProcessoParado = {
      id: p.id,
      titulo: p.titulo,
      etapa: p.etapa_atual,
      etapaLabel: stage ? `${stage.num}. ${stage.label}` : p.etapa_atual,
      diasParado,
      aguardandoDecisao: !!pendente,
    };

    // Fora do prazo é medido contra a META da etapa (quando existe) — uma
    // compra pode estourar o SLA em 4 horas e nunca aparecer como "parada".
    const meta = slas[p.etapa_atual];
    if (meta && meta > 0 && paradoMs > meta * 60 * 60 * 1000) {
      foraDoPrazo.push(linha);
    }

    if (diasParado >= DIAS_PARA_ALERTA) parados.push(linha);
  }

  parados.sort((a, b) => b.diasParado - a.diasParado);
  foraDoPrazo.sort((a, b) => b.diasParado - a.diasParado);

  return {
    totalProcessos: processos.length,
    emAndamento: emAndamento.length,
    concluidos: concluidos.length,
    cicloMedioDias: media(ciclos),
    parados,
    foraDoPrazo,
    aguardandoDecisao: aguardando,
    etapas: metricas,
  };
}
