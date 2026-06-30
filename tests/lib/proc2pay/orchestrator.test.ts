import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Proc2PayProcess } from '@/lib/proc2pay/types';

beforeEach(() => vi.resetModules());

function baseProcess(over: Partial<Proc2PayProcess> = {}): Proc2PayProcess {
  return {
    id: 'p1',
    user_id: 'u1',
    numero: 'PC-2026-000001',
    titulo: 'Compra',
    status: 'requisicao',
    state: 'em_andamento',
    origem: 'manual',
    requisicao: { solicitante: 'Prod', descricao: 'x', itens: [] },
    context: { requisicao: { solicitante: 'Prod', descricao: 'x', itens: [] } },
    is_example: false,
    created_at: 't',
    updated_at: 't',
    ...over,
  };
}

function mockDeps(opts: {
  exec?: () => Promise<unknown>;
  saveReturns?: Proc2PayProcess | null;
} = {}) {
  const saveStageResult = vi.fn().mockResolvedValue(opts.saveReturns ?? baseProcess({ status: 'estrategia' }));
  const setProcessState = vi.fn().mockResolvedValue(undefined);
  vi.doMock('@/lib/proc2pay/process', () => ({ saveStageResult, setProcessState }));
  vi.doMock('@/lib/proc2pay/executors', () => ({
    executeStage:
      opts.exec ??
      vi.fn().mockResolvedValue({
        output: { quadranteKraljic: 'estrategico', postura: 'parceria' },
        artifactMd: '# Estratégia',
        usage: { tokensIn: 10, tokensOut: 5, tokensCached: 0 },
        model: 'gpt-5.4-mini',
        operation: 'proc2pay-estrategia',
      }),
  }));
  vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage: vi.fn() }));
  return { saveStageResult, setProcessState };
}

async function run(args: Parameters<typeof import('@/lib/proc2pay/orchestrator').runStage>[0]) {
  const { runStage } = await import('@/lib/proc2pay/orchestrator');
  return runStage(args);
}

describe('runStage', () => {
  it('recusa etapas não-executáveis (aprovacao/requisicao)', async () => {
    mockDeps();
    const r = await run({ userId: 'u1', process: baseProcess(), stage: 'aprovacao' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not_runnable');
  });

  it('recusa quando o gating não permite (estratégia sem requisição)', async () => {
    mockDeps();
    const proc = baseProcess({ context: {} });
    const r = await run({ userId: 'u1', process: proc, stage: 'estrategia' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not_runnable');
  });

  it('executa a etapa e faz o handoff (saveStageResult concluido)', async () => {
    // análise crítica é a 1ª etapa executável (roda só com a requisição)
    const { saveStageResult } = mockDeps();
    const r = await run({ userId: 'u1', process: baseProcess(), stage: 'analise_critica' });
    expect(r.ok).toBe(true);
    expect(saveStageResult).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'analise_critica', status: 'concluido' }),
    );
  });

  it('falha de execução grava stage_run com status erro', async () => {
    const { saveStageResult } = mockDeps({
      exec: vi.fn().mockRejectedValue(new Error('sem propostas')),
    });
    const r = await run({ userId: 'u1', process: baseProcess(), stage: 'analise_critica' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('exec_failed');
    expect(saveStageResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'erro', errorMessage: 'sem propostas' }),
    );
  });

  it('emissao_po fecha o processo (setProcessState concluido)', async () => {
    // context com tudo até negociacao + aprovacao completos
    const fullCtx = {
      requisicao: { solicitante: 'P', descricao: 'x', itens: [] },
      analise_critica: { ok: true, gaps: [] },
      escopo: { resumo: 'x' },
      estrategia: { postura: 'x' },
      fornecedores: [{ nome: 'A' }],
      rfp: { documento: 'x' },
      propostas: [{ texto: 'x' }],
      equalizacao: { vencedor: { nome: 'A' } },
      negociacao: { acordo: 'x' },
      aprovacao: { decision: 'aprovado' as const },
    };
    const proc = baseProcess({ status: 'aprovacao', context: fullCtx });
    const { setProcessState } = mockDeps({
      exec: vi.fn().mockResolvedValue({
        output: { numero: 'PO-1', fornecedor: { nome: 'A' } },
        artifactMd: '# PO',
        usage: { tokensIn: 1, tokensOut: 1, tokensCached: 0 },
        model: 'gpt-5.4-mini',
        operation: 'proc2pay-po',
      }),
      saveReturns: baseProcess({ status: 'emissao_po', context: fullCtx }),
    });
    const r = await run({ userId: 'u1', process: proc, stage: 'emissao_po' });
    expect(r.ok).toBe(true);
    expect(setProcessState).toHaveBeenCalledWith('u1', 'p1', 'concluido');
  });
});
