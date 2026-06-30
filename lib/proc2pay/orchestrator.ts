// Proc2Pay — motor de execução de etapa. Liga executor + persistência +
// custo + gating. O coração do handoff: a saída de uma etapa vira contexto da
// próxima.

import { recordApiUsage, type ApiOperation } from '@/lib/observability/api-usage';
import { executeStage, type StagePayload } from './executors';
import { canRunStage, getStage } from './stages';
import { saveStageResult, setProcessState } from './process';
import type { Proc2PayProcess, StageId } from './types';

export type RunStageResult =
  | { ok: true; process: Proc2PayProcess; artifactMd: string }
  | { ok: false; error: string; code: 'not_runnable' | 'exec_failed' };

/**
 * Executa uma etapa do processo: valida o gating sequencial, roda o executor
 * com o contexto carregado, registra custo, persiste o stage_run e faz o merge
 * da saída no contexto (avançando o status). `aprovacao` é tratada à parte
 * (recordApproval); `requisicao` nasce na criação do processo.
 */
export async function runStage(input: {
  userId: string;
  process: Proc2PayProcess;
  stage: StageId;
  payload?: StagePayload;
}): Promise<RunStageResult> {
  const { userId, process, stage, payload } = input;

  if (stage === 'aprovacao' || stage === 'requisicao') {
    return { ok: false, error: `Etapa "${stage}" não roda por aqui.`, code: 'not_runnable' };
  }
  if (!canRunStage(stage, process.context)) {
    return {
      ok: false,
      error: 'Conclua as etapas anteriores antes desta.',
      code: 'not_runnable',
    };
  }

  let exec;
  try {
    exec = await executeStage(stage, process.context, payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao executar a etapa.';
    await saveStageResult({
      userId,
      process,
      stage,
      status: 'erro',
      stageInput: payload ?? null,
      errorMessage: msg,
    });
    return { ok: false, error: msg, code: 'exec_failed' };
  }

  // Custo — fire-and-forget; falha de tracking nunca quebra o fluxo.
  if (exec.model !== '-') {
    void recordApiUsage({
      provider: 'openai',
      operation: exec.operation as ApiOperation,
      model: exec.model,
      tokensIn: exec.usage.tokensIn,
      tokensOut: exec.usage.tokensOut,
      tokensCached: exec.usage.tokensCached,
      userId,
      metadata: { proc2pay_process_id: process.id, stage },
    });
  }

  const updated = await saveStageResult({
    userId,
    process,
    stage,
    status: 'concluido',
    stageInput: payload ?? null,
    output: (exec.output ?? null) as Record<string, unknown> | null,
    artifactMd: exec.artifactMd,
  });
  if (!updated) {
    return { ok: false, error: 'Falha ao salvar o resultado da etapa.', code: 'exec_failed' };
  }

  // Etapa final do trilho → fecha o processo.
  if (getStage(stage).id === 'emissao_po') {
    await setProcessState(userId, process.id, 'concluido');
    updated.state = 'concluido';
  }

  return { ok: true, process: updated, artifactMd: exec.artifactMd };
}
