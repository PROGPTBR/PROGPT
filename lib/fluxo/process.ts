import { getServerSupabase } from '@/lib/db/supabase';

import { FLUXO_STAGES, getStage, proximaEtapa, type FluxoStage, type FluxoStageId } from './stages';
import { executarEtapa } from './executor';
import type {
  FluxoContexto,
  FluxoDecisao,
  FluxoEtapa,
  FluxoProcesso,
  FluxoStageOutput,
} from './types';

// Serviço do Fluxo Automatizado de Compras.
//
// Tudo passa por service-role + filtro `.eq('user_id')` EXPLÍCITO. É esse
// filtro que segura o isolamento entre clientes — remover qualquer um deles
// vaza processo de compra de uma empresa para outra.

function svc() {
  return getServerSupabase();
}

// --- Leitura ----------------------------------------------------------------

export async function listarProcessos(userId: string, limite = 50): Promise<FluxoProcesso[]> {
  const { data, error } = await svc()
    .from('fluxo_processos')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('[fluxo] listar falhou:', error.message);
    return [];
  }
  return (data ?? []) as FluxoProcesso[];
}

export async function getProcesso(
  userId: string,
  processoId: string,
): Promise<{ processo: FluxoProcesso; etapas: FluxoEtapa[] } | null> {
  const { data } = await svc()
    .from('fluxo_processos')
    .select('*')
    .eq('id', processoId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;

  const { data: etapas } = await svc()
    .from('fluxo_etapas')
    .select('*')
    .eq('processo_id', processoId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  return { processo: data as FluxoProcesso, etapas: (etapas ?? []) as FluxoEtapa[] };
}

// --- Escrita ----------------------------------------------------------------

export async function criarProcesso(args: {
  userId: string;
  titulo: string;
  requisicao: string;
}): Promise<FluxoProcesso | null> {
  const { data, error } = await svc()
    .from('fluxo_processos')
    .insert({
      user_id: args.userId,
      titulo: args.titulo.trim().slice(0, 200) || 'Nova compra',
      requisicao: args.requisicao.trim().slice(0, 20000),
      etapa_atual: FLUXO_STAGES[0]!.id,
      status: 'em_andamento',
      contexto: {},
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[fluxo] criar falhou:', error.message);
    return null;
  }
  return data as FluxoProcesso;
}

/** Execução pendente (aguardando decisão) da etapa, se houver. */
export function pendenteDaEtapa(etapas: FluxoEtapa[], etapa: FluxoStageId): FluxoEtapa | null {
  return (
    etapas.find((e) => e.etapa === etapa && e.decisao === 'pendente') ?? null
  );
}

function proximaRodada(etapas: FluxoEtapa[], etapa: FluxoStageId): number {
  const rodadas = etapas.filter((e) => e.etapa === etapa).map((e) => e.rodada);
  return rodadas.length ? Math.max(...rodadas) + 1 : 1;
}

export type RunResult =
  | { ok: true; etapa: FluxoEtapa }
  | {
      ok: false;
      reason: 'nao_encontrado' | 'etapa_invalida' | 'fora_de_ordem' | 'ja_pendente' | 'encerrado' | 'falhou';
    };

/**
 * Roda a etapa ATUAL do processo e deixa o resultado aguardando decisão.
 * Não avança nada sozinho — avançar é exclusividade do SIGA.
 */
export async function rodarEtapa(args: {
  userId: string;
  processoId: string;
  entrada?: string;
}): Promise<RunResult> {
  const carregado = await getProcesso(args.userId, args.processoId);
  if (!carregado) return { ok: false, reason: 'nao_encontrado' };

  const { processo, etapas } = carregado;
  if (processo.status !== 'em_andamento') return { ok: false, reason: 'encerrado' };

  const stage = getStage(processo.etapa_atual);
  if (!stage) return { ok: false, reason: 'etapa_invalida' };

  // Já existe execução aguardando decisão: o comprador precisa decidir antes
  // de gastar outra chamada de IA na mesma etapa.
  if (pendenteDaEtapa(etapas, stage.id)) return { ok: false, reason: 'ja_pendente' };

  // O AJUSTAR mais recente desta etapa é a correção a atender.
  const ultimoAjuste =
    [...etapas]
      .reverse()
      .find((e) => e.etapa === stage.id && e.decisao === 'ajustar')?.observacao ?? null;

  let saida: FluxoStageOutput;
  try {
    saida = await executarEtapa({
      stage,
      requisicao: processo.requisicao,
      contexto: (processo.contexto ?? {}) as FluxoContexto,
      entrada: args.entrada ?? '',
      ajuste: ultimoAjuste,
      userId: args.userId,
    });
  } catch (err) {
    console.error('[fluxo] execução da etapa falhou:', err);
    return { ok: false, reason: 'falhou' };
  }

  const { data, error } = await svc()
    .from('fluxo_etapas')
    .insert({
      processo_id: processo.id,
      user_id: args.userId,
      etapa: stage.id,
      rodada: proximaRodada(etapas, stage.id),
      saida,
      decisao: 'pendente',
    })
    .select('*')
    .maybeSingle();

  if (error || !data) {
    console.error('[fluxo] gravar etapa falhou:', error?.message);
    return { ok: false, reason: 'falhou' };
  }

  await svc()
    .from('fluxo_processos')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', processo.id)
    .eq('user_id', args.userId);

  return { ok: true, etapa: data as FluxoEtapa };
}

export type DecisaoResult =
  | { ok: true; processo: FluxoProcesso; concluido: boolean }
  | { ok: false; reason: 'nao_encontrado' | 'sem_pendencia' | 'decisao_invalida' | 'falhou' };

/**
 * SIGA  → grava a saída no contexto e move para a próxima etapa (ou conclui).
 * AJUSTAR → registra a correção; a etapa continua a mesma e pode rodar de novo.
 */
export async function decidirEtapa(args: {
  userId: string;
  processoId: string;
  decisao: Exclude<FluxoDecisao, 'pendente'>;
  observacao?: string;
}): Promise<DecisaoResult> {
  if (args.decisao !== 'siga' && args.decisao !== 'ajustar') {
    return { ok: false, reason: 'decisao_invalida' };
  }

  const carregado = await getProcesso(args.userId, args.processoId);
  if (!carregado) return { ok: false, reason: 'nao_encontrado' };

  const { processo, etapas } = carregado;
  const stage = getStage(processo.etapa_atual);
  if (!stage) return { ok: false, reason: 'nao_encontrado' };

  const pendente = pendenteDaEtapa(etapas, stage.id);
  if (!pendente) return { ok: false, reason: 'sem_pendencia' };

  const agora = new Date().toISOString();

  const { error: decisaoError } = await svc()
    .from('fluxo_etapas')
    .update({
      decisao: args.decisao,
      observacao: args.observacao?.trim().slice(0, 4000) || null,
      decidida_em: agora,
    })
    .eq('id', pendente.id)
    .eq('user_id', args.userId);

  if (decisaoError) {
    console.error('[fluxo] gravar decisão falhou:', decisaoError.message);
    return { ok: false, reason: 'falhou' };
  }

  // AJUSTAR mantém a etapa: o processo não anda até a IA refazer e o
  // comprador aprovar.
  if (args.decisao === 'ajustar') {
    const { data } = await svc()
      .from('fluxo_processos')
      .update({ updated_at: agora })
      .eq('id', processo.id)
      .eq('user_id', args.userId)
      .select('*')
      .maybeSingle();

    return { ok: true, processo: (data ?? processo) as FluxoProcesso, concluido: false };
  }

  const proxima = proximaEtapa(stage.id);
  const contexto: FluxoContexto = { ...(processo.contexto ?? {}), [stage.id]: pendente.saida };

  const { data, error } = await svc()
    .from('fluxo_processos')
    .update({
      contexto,
      etapa_atual: proxima ? proxima.id : stage.id,
      status: proxima ? 'em_andamento' : 'concluido',
      updated_at: agora,
    })
    .eq('id', processo.id)
    .eq('user_id', args.userId)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    console.error('[fluxo] avançar falhou:', error?.message);
    return { ok: false, reason: 'falhou' };
  }

  return { ok: true, processo: data as FluxoProcesso, concluido: !proxima };
}

/** Progresso para a barra do topo: quantas etapas já receberam SIGA. */
export function progresso(processo: FluxoProcesso): { concluidas: number; total: number } {
  const concluidas = FLUXO_STAGES.filter((s: FluxoStage) => !!processo.contexto?.[s.id]).length;
  return { concluidas, total: FLUXO_STAGES.length };
}
