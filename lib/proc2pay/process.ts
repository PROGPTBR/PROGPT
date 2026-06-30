// Proc2Pay — camada de acesso a dados (service-role + filtro user_id explícito,
// defesa em profundidade, padrão getRunForOwner). Owner-scoped.

import { getServerSupabase } from '@/lib/db/supabase';
import { getStage } from './stages';
import type {
  Proc2PayApproval,
  Proc2PayContext,
  Proc2PayProcess,
  Proc2PayStageRun,
  RequisicaoPayload,
  StageId,
  StageRunStatus,
} from './types';

function genNumero(): string {
  const year = new Date().getFullYear();
  const tail = String(Date.now()).slice(-6);
  return `PC-${year}-${tail}`;
}

export async function createProcess(input: {
  userId: string;
  requisicao: RequisicaoPayload;
  titulo?: string;
  origem?: 'email' | 'manual' | 'exemplo';
  isExample?: boolean;
  inboundEmailId?: string; // idempotência do webhook (guardado no context)
}): Promise<Proc2PayProcess | null> {
  const sb = getServerSupabase();
  const titulo = input.titulo?.trim() || input.requisicao.descricao?.slice(0, 80) || 'Processo de compra';
  const context: Record<string, unknown> = { requisicao: input.requisicao };
  if (input.inboundEmailId) context.inbound_email_id = input.inboundEmailId;
  const row = {
    user_id: input.userId,
    numero: genNumero(),
    titulo,
    status: 'requisicao' as StageId,
    state: 'em_andamento' as const,
    origem: input.origem ?? 'manual',
    requisicao: input.requisicao,
    context: context as Proc2PayContext,
    is_example: input.isExample ?? false,
  };
  const { data, error } = await sb.from('proc2pay_processes').insert(row).select().single();
  if (error) {
    console.error('[proc2pay] createProcess failed:', error.message);
    return null;
  }
  return data as Proc2PayProcess;
}

/** Dedup do webhook: já existe processo criado por este e-mail recebido? */
export async function processExistsForInboundEmail(
  userId: string,
  emailId: string,
): Promise<boolean> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from('proc2pay_processes')
    .select('id')
    .eq('user_id', userId)
    .eq('context->>inbound_email_id', emailId)
    .maybeSingle();
  return !!data;
}

export async function getProcessForOwner(
  userId: string,
  id: string,
): Promise<Proc2PayProcess | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('proc2pay_processes')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[proc2pay] getProcessForOwner failed:', error.message);
    return null;
  }
  return (data as Proc2PayProcess) ?? null;
}

export async function listProcesses(userId: string): Promise<Proc2PayProcess[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('proc2pay_processes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[proc2pay] listProcesses failed:', error.message);
    return [];
  }
  return (data as Proc2PayProcess[]) ?? [];
}

export async function listStageRuns(
  userId: string,
  processId: string,
): Promise<Proc2PayStageRun[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('proc2pay_stage_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('process_id', processId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[proc2pay] listStageRuns failed:', error.message);
    return [];
  }
  return (data as Proc2PayStageRun[]) ?? [];
}

/**
 * Persiste o resultado de uma etapa: grava o stage_run, faz merge da saída no
 * `context` do processo e avança `status` para a etapa concluída. Devolve o
 * processo atualizado.
 */
export async function saveStageResult(input: {
  userId: string;
  process: Proc2PayProcess;
  stage: StageId;
  status: StageRunStatus;
  stageInput?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  artifactMd?: string | null;
  errorMessage?: string | null;
  assistantRunId?: string | null;
}): Promise<Proc2PayProcess | null> {
  const sb = getServerSupabase();

  await sb.from('proc2pay_stage_runs').insert({
    process_id: input.process.id,
    user_id: input.userId,
    stage: input.stage,
    assistant_run_id: input.assistantRunId ?? null,
    status: input.status,
    input: input.stageInput ?? null,
    output: input.output ?? null,
    artifact_md: input.artifactMd ?? null,
    error_message: input.errorMessage ?? null,
  });

  if (input.status !== 'concluido') {
    // Etapa falhou/pulou — não mexe no context nem no status.
    return input.process;
  }

  const produces = getStage(input.stage).produces;
  const nextContext: Proc2PayContext = { ...input.process.context };
  if (produces && input.output != null) {
    (nextContext as Record<string, unknown>)[produces] = input.output;
  }

  const { data, error } = await sb
    .from('proc2pay_processes')
    .update({
      context: nextContext,
      status: input.stage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.process.id)
    .eq('user_id', input.userId)
    .select()
    .single();
  if (error) {
    console.error('[proc2pay] saveStageResult update failed:', error.message);
    return null;
  }
  return data as Proc2PayProcess;
}

export async function recordApproval(input: {
  userId: string;
  process: Proc2PayProcess;
  decision: 'aprovado' | 'reprovado';
  comment?: string;
  approverId?: string;
}): Promise<Proc2PayProcess | null> {
  const sb = getServerSupabase();
  await sb.from('proc2pay_approvals').insert({
    process_id: input.process.id,
    user_id: input.userId,
    approver_id: input.approverId ?? input.userId,
    decision: input.decision,
    comment: input.comment ?? null,
  });
  return saveStageResult({
    userId: input.userId,
    process: input.process,
    stage: 'aprovacao',
    status: 'concluido',
    output: { decision: input.decision, comment: input.comment },
    artifactMd: `Decisão de aprovação: **${input.decision}**${input.comment ? `\n\n> ${input.comment}` : ''}`,
  });
}

export async function setProcessState(
  userId: string,
  processId: string,
  state: 'em_andamento' | 'concluido' | 'cancelado',
): Promise<void> {
  const sb = getServerSupabase();
  await sb
    .from('proc2pay_processes')
    .update({ state, updated_at: new Date().toISOString() })
    .eq('id', processId)
    .eq('user_id', userId);
}

export async function listApprovals(
  userId: string,
  processId: string,
): Promise<Proc2PayApproval[]> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from('proc2pay_approvals')
    .select('*')
    .eq('user_id', userId)
    .eq('process_id', processId)
    .order('decided_at', { ascending: false });
  return (data as Proc2PayApproval[]) ?? [];
}
