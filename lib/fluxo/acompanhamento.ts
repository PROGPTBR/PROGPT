import { getServerSupabase } from '@/lib/db/supabase';
import { configuredAppUrl } from '@/lib/app-url';
import { sendEmail } from '@/lib/email/client';
import { buildFluxoAprovacaoEmail, buildFluxoDecisaoGestorEmail } from '@/lib/email/templates';

import { FLUXO_STAGES, getStage } from './stages';
import { decidirEtapa, getProcesso, pendenteDaEtapa } from './process';
import {
  emailValido,
  linkAcompanhamento,
  linkAprovacao,
  notificarSolicitante,
  novoTokenFluxo,
} from './notificacoes';
import type { FluxoAprovacao, FluxoEtapa, FluxoProcesso, FluxoStageOutput } from './types';

// Fluxo de Compras, Fase 1 (sub-projeto 90): quem pediu a compra acompanha
// pelo link, e o gestor aprova ou reprova pelo e-mail, os dois sem conta.
//
// Os links públicos carregam um token de 32 bytes, que é a credencial. Toda
// leitura por token usa service-role, e depois disso tudo filtra pelo
// user_id DO PROCESSO, como no resto do Fluxo.

function svc() {
  return getServerSupabase();
}

/** Colunas da aprovação que podem ir para o navegador do comprador (sem o token). */
const APROVACAO_PUBLICA =
  'id, processo_id, user_id, etapa, etapa_execucao_id, aprovador_nome, aprovador_email, status, comentario, expira_em, decidido_em, created_at';

function dataBr(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

async function nomeDoComprador(userId: string): Promise<{ nome: string; email: string }> {
  const sb = svc();
  const [{ data: perfil }, { data: auth }] = await Promise.all([
    sb.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    sb.auth.admin.getUserById(userId),
  ]);
  const email = auth?.user?.email ?? '';
  const nome = ((perfil as { full_name?: string | null } | null)?.full_name ?? '').trim();
  return { nome: nome || email, email };
}

// --- Link de acompanhamento ---------------------------------------------------

export type AcompanhamentoResult =
  | { ok: true; processo: FluxoProcesso; link: string; enviado: boolean }
  | { ok: false; reason: 'nao_encontrado' | 'email_invalido' | 'falhou' };

/**
 * Garante o link de acompanhamento do processo (processos criados antes da
 * Fase 1 não têm) e, se vier o contato de quem pediu a compra, grava e envia
 * o link para ele.
 */
export async function configurarAcompanhamento(args: {
  userId: string;
  processoId: string;
  solicitanteNome?: string;
  solicitanteEmail?: string;
  enviar?: boolean;
}): Promise<AcompanhamentoResult> {
  const carregado = await getProcesso(args.userId, args.processoId);
  if (!carregado) return { ok: false, reason: 'nao_encontrado' };

  const email = args.solicitanteEmail?.trim().toLowerCase() ?? '';
  if (email && !emailValido(email)) return { ok: false, reason: 'email_invalido' };

  const patch: Record<string, unknown> = {};
  if (!carregado.processo.acompanhamento_token) patch.acompanhamento_token = novoTokenFluxo();
  if (args.solicitanteNome !== undefined) patch.solicitante_nome = args.solicitanteNome.trim().slice(0, 120) || null;
  if (args.solicitanteEmail !== undefined) patch.solicitante_email = email.slice(0, 200) || null;

  let processo = carregado.processo;
  if (Object.keys(patch).length) {
    const { data, error } = await svc()
      .from('fluxo_processos')
      .update(patch)
      .eq('id', args.processoId)
      .eq('user_id', args.userId)
      .select('*')
      .maybeSingle();
    if (error || !data) {
      console.error('[fluxo] configurar acompanhamento falhou:', error?.message);
      return { ok: false, reason: 'falhou' };
    }
    processo = data as FluxoProcesso;
  }

  const enviado = args.enviar && processo.solicitante_email ? await notificarSolicitante({ processo }) : false;

  return { ok: true, processo, link: linkAcompanhamento(processo.acompanhamento_token!), enviado };
}

export type EstadoEtapaPublica = 'concluida' | 'atual' | 'futura';

export type AcompanhamentoPublico = {
  titulo: string;
  solicitanteNome: string | null;
  abertoEm: string;
  atualizadoEm: string;
  concluido: boolean;
  cancelado: boolean;
  /** O que a etapa atual está esperando, em linguagem simples. */
  aguardando: string | null;
  etapas: Array<{ num: number; label: string; estado: EstadoEtapaPublica; concluidaEm: string | null }>;
};

/** Montagem pura do que o solicitante vê. Só andamento: sem preço, proposta nem fornecedor. */
export function montarAcompanhamento(
  processo: FluxoProcesso,
  etapas: FluxoEtapa[],
  aprovacaoPendente: Pick<FluxoAprovacao, 'aprovador_nome' | 'aprovador_email' | 'etapa'> | null,
): AcompanhamentoPublico {
  const concluido = processo.status === 'concluido';
  const cancelado = processo.status === 'cancelado';

  const lista = FLUXO_STAGES.map((s) => {
    const aprovada = !!processo.contexto?.[s.id];
    const siga = etapas.filter((e) => e.etapa === s.id && e.decisao === 'siga').pop();
    const estado: EstadoEtapaPublica = aprovada
      ? 'concluida'
      : s.id === processo.etapa_atual && !concluido
        ? 'atual'
        : 'futura';
    return { num: s.num, label: s.label, estado, concluidaEm: aprovada ? (siga?.decidida_em ?? null) : null };
  });

  let aguardando: string | null = null;
  if (!concluido && !cancelado) {
    if (aprovacaoPendente && aprovacaoPendente.etapa === processo.etapa_atual) {
      const quem = aprovacaoPendente.aprovador_nome.trim() || 'o gestor';
      aguardando = `Aguardando a aprovação de ${quem}.`;
    } else if (pendenteDaEtapa(etapas, processo.etapa_atual)) {
      aguardando = 'Em revisão pelo time de compras.';
    } else {
      aguardando = 'Em andamento com o time de compras.';
    }
  }

  return {
    titulo: processo.titulo,
    solicitanteNome: processo.solicitante_nome ?? null,
    abertoEm: processo.created_at,
    atualizadoEm: processo.updated_at,
    concluido,
    cancelado,
    aguardando,
    etapas: lista,
  };
}

export async function getAcompanhamentoPorToken(token: string): Promise<AcompanhamentoPublico | null> {
  if (!token || token.length < 20) return null;
  const sb = svc();
  const { data } = await sb.from('fluxo_processos').select('*').eq('acompanhamento_token', token).maybeSingle();
  if (!data) return null;
  const processo = data as FluxoProcesso;

  const [{ data: etapas }, { data: aprov }] = await Promise.all([
    sb
      .from('fluxo_etapas')
      .select('*')
      .eq('processo_id', processo.id)
      .eq('user_id', processo.user_id)
      .order('created_at', { ascending: true }),
    sb
      .from('fluxo_aprovacoes')
      .select('aprovador_nome, aprovador_email, etapa')
      .eq('processo_id', processo.id)
      .eq('user_id', processo.user_id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const pendente = ((aprov ?? []) as Array<Pick<FluxoAprovacao, 'aprovador_nome' | 'aprovador_email' | 'etapa'>>)[0] ?? null;
  return montarAcompanhamento(processo, (etapas ?? []) as FluxoEtapa[], pendente);
}

// --- Aprovação do gestor por e-mail --------------------------------------------

export async function listarAprovacoes(userId: string, processoId: string): Promise<FluxoAprovacao[]> {
  const { data } = await svc()
    .from('fluxo_aprovacoes')
    .select(APROVACAO_PUBLICA)
    .eq('processo_id', processoId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return ((data ?? []) as Array<FluxoAprovacao & { token?: string }>).map(({ token: _t, ...a }) => {
    void _t;
    return a;
  });
}

/** O comprador decidiu no app: pedidos ainda abertos deixam de valer. */
export async function cancelarAprovacoesPendentes(userId: string, processoId: string): Promise<void> {
  const { error } = await svc()
    .from('fluxo_aprovacoes')
    .update({ status: 'cancelado', decidido_em: new Date().toISOString() })
    .eq('processo_id', processoId)
    .eq('user_id', userId)
    .eq('status', 'pendente');
  if (error) console.warn('[fluxo] cancelar aprovações falhou:', error.message);
}

export type PedirAprovacaoResult =
  | { ok: true; aprovacao: FluxoAprovacao; enviado: boolean }
  | { ok: false; reason: 'nao_encontrado' | 'sem_pendencia' | 'email_invalido' | 'falhou' };

export async function pedirAprovacao(args: {
  userId: string;
  processoId: string;
  aprovadorNome: string;
  aprovadorEmail: string;
}): Promise<PedirAprovacaoResult> {
  const email = args.aprovadorEmail.trim().toLowerCase();
  if (!emailValido(email)) return { ok: false, reason: 'email_invalido' };

  const carregado = await getProcesso(args.userId, args.processoId);
  if (!carregado) return { ok: false, reason: 'nao_encontrado' };
  const { processo, etapas } = carregado;

  const stage = getStage(processo.etapa_atual);
  const pendente = stage ? pendenteDaEtapa(etapas, stage.id) : null;
  if (!stage || !pendente || processo.status !== 'em_andamento') return { ok: false, reason: 'sem_pendencia' };

  // Um pedido aberto por vez: reenviar para outra pessoa substitui o anterior.
  await cancelarAprovacoesPendentes(args.userId, args.processoId);

  const token = novoTokenFluxo();
  const { data, error } = await svc()
    .from('fluxo_aprovacoes')
    .insert({
      processo_id: processo.id,
      user_id: args.userId,
      etapa: stage.id,
      etapa_execucao_id: pendente.id,
      aprovador_nome: args.aprovadorNome.trim().slice(0, 120),
      aprovador_email: email.slice(0, 200),
      token,
    })
    .select(APROVACAO_PUBLICA)
    .maybeSingle();

  if (error || !data) {
    console.error('[fluxo] pedir aprovação falhou:', error?.message);
    return { ok: false, reason: 'falhou' };
  }
  // O select já não traz o token; tirar de novo garante que ele nunca volte
  // para o navegador do comprador, mesmo se alguém mudar a lista de colunas.
  const { token: _semToken, ...semToken } = data as unknown as FluxoAprovacao & { token?: string };
  void _semToken;
  const aprovacao = semToken as FluxoAprovacao;

  let enviado = false;
  try {
    const comprador = await nomeDoComprador(args.userId);
    const { subject, html } = buildFluxoAprovacaoEmail({
      aprovadorNome: aprovacao.aprovador_nome,
      compradorNome: comprador.nome,
      tituloCompra: processo.titulo,
      etapaLabel: stage.label,
      resumo: pendente.saida.resumo,
      link: linkAprovacao(token),
      expiraEm: dataBr(aprovacao.expira_em),
    });
    enviado = (await sendEmail({ to: email, subject, html })).ok;
  } catch (err) {
    console.warn('[fluxo] e-mail de aprovação falhou:', err);
  }

  return { ok: true, aprovacao, enviado };
}

export type AprovacaoPublica = {
  estado: 'pendente' | 'aprovado' | 'reprovado' | 'cancelado' | 'expirado' | 'superado';
  aprovadorNome: string;
  tituloCompra: string;
  requisicao: string;
  etapaLabel: string;
  saida: FluxoStageOutput | null;
  comentario: string | null;
  decididoEm: string | null;
};

type AprovacaoComToken = FluxoAprovacao & { token: string };

async function carregarPorToken(token: string): Promise<{
  aprovacao: AprovacaoComToken;
  processo: FluxoProcesso;
  execucao: FluxoEtapa | null;
} | null> {
  if (!token || token.length < 20) return null;
  const sb = svc();
  const { data } = await sb.from('fluxo_aprovacoes').select('*').eq('token', token).maybeSingle();
  if (!data) return null;
  const aprovacao = data as AprovacaoComToken;

  const [{ data: proc }, { data: exec }] = await Promise.all([
    sb.from('fluxo_processos').select('*').eq('id', aprovacao.processo_id).eq('user_id', aprovacao.user_id).maybeSingle(),
    sb
      .from('fluxo_etapas')
      .select('*')
      .eq('id', aprovacao.etapa_execucao_id)
      .eq('user_id', aprovacao.user_id)
      .maybeSingle(),
  ]);
  if (!proc) return null;
  return { aprovacao, processo: proc as FluxoProcesso, execucao: (exec as FluxoEtapa | null) ?? null };
}

/** Pedido ainda pode ser decidido? Puro, para o teste travar as regras. */
export function estadoDaAprovacao(
  aprovacao: Pick<FluxoAprovacao, 'status' | 'expira_em'>,
  execucao: Pick<FluxoEtapa, 'decisao'> | null,
  agora: Date = new Date(),
): AprovacaoPublica['estado'] {
  if (aprovacao.status !== 'pendente') return aprovacao.status;
  if (new Date(aprovacao.expira_em).getTime() < agora.getTime()) return 'expirado';
  // O comprador decidiu no app ou a etapa foi refeita depois do envio.
  if (!execucao || execucao.decisao !== 'pendente') return 'superado';
  return 'pendente';
}

export async function getAprovacaoPorToken(token: string): Promise<AprovacaoPublica | null> {
  const carregado = await carregarPorToken(token);
  if (!carregado) return null;
  const { aprovacao, processo, execucao } = carregado;
  return {
    estado: estadoDaAprovacao(aprovacao, execucao),
    aprovadorNome: aprovacao.aprovador_nome,
    tituloCompra: processo.titulo,
    requisicao: processo.requisicao,
    etapaLabel: getStage(aprovacao.etapa)?.label ?? aprovacao.etapa,
    saida: execucao?.saida ?? null,
    comentario: aprovacao.comentario,
    decididoEm: aprovacao.decidido_em,
  };
}

export type DecidirAprovacaoResult =
  | { ok: true; aprovado: boolean }
  | { ok: false; reason: 'nao_encontrado' | 'indisponivel' | 'sem_motivo' | 'falhou'; estado?: AprovacaoPublica['estado'] };

export async function decidirAprovacao(args: {
  token: string;
  aprovado: boolean;
  comentario?: string;
}): Promise<DecidirAprovacaoResult> {
  const comentario = (args.comentario ?? '').trim().slice(0, 4000);
  if (!args.aprovado && !comentario) return { ok: false, reason: 'sem_motivo' };

  const carregado = await carregarPorToken(args.token);
  if (!carregado) return { ok: false, reason: 'nao_encontrado' };
  const { aprovacao, processo, execucao } = carregado;

  const estado = estadoDaAprovacao(aprovacao, execucao);
  if (estado !== 'pendente') return { ok: false, reason: 'indisponivel', estado };

  const sb = svc();
  const agora = new Date().toISOString();

  // Reserva o pedido antes de mexer no processo: dois cliques (ou o link
  // aberto em dois lugares) não decidem duas vezes.
  const { data: reservado } = await sb
    .from('fluxo_aprovacoes')
    .update({ status: args.aprovado ? 'aprovado' : 'reprovado', comentario: comentario || null, decidido_em: agora })
    .eq('id', aprovacao.id)
    .eq('status', 'pendente')
    .select('id')
    .maybeSingle();
  if (!reservado) return { ok: false, reason: 'indisponivel', estado: 'superado' };

  const quem = aprovacao.aprovador_nome.trim() || aprovacao.aprovador_email;
  const observacao = args.aprovado
    ? `Aprovado por ${quem} (${aprovacao.aprovador_email}) pelo e-mail.${comentario ? ` Comentário: ${comentario}` : ''}`
    : `Reprovado por ${quem} (${aprovacao.aprovador_email}) pelo e-mail. Motivo: ${comentario}`;

  const resultado = await decidirEtapa({
    userId: aprovacao.user_id,
    processoId: processo.id,
    decisao: args.aprovado ? 'siga' : 'ajustar',
    observacao,
  });

  if (!resultado.ok) {
    // Devolve o pedido para pendente: o gestor pode tentar de novo.
    await sb
      .from('fluxo_aprovacoes')
      .update({ status: 'pendente', comentario: null, decidido_em: null })
      .eq('id', aprovacao.id);
    return { ok: false, reason: 'falhou' };
  }

  // Avisa o comprador. Fail-soft.
  void (async () => {
    try {
      const comprador = await nomeDoComprador(aprovacao.user_id);
      if (!comprador.email) return;
      const { subject, html } = buildFluxoDecisaoGestorEmail({
        aprovadorNome: aprovacao.aprovador_nome,
        aprovadorEmail: aprovacao.aprovador_email,
        tituloCompra: processo.titulo,
        etapaLabel: getStage(aprovacao.etapa)?.label ?? aprovacao.etapa,
        aprovado: args.aprovado,
        comentario,
        link: `${configuredAppUrl()}/fluxo/${processo.id}`,
      });
      await sendEmail({ to: comprador.email, subject, html });
    } catch (err) {
      console.warn('[fluxo] aviso ao comprador falhou:', err);
    }
  })();

  return { ok: true, aprovado: args.aprovado };
}
