import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => vi.resetModules());

// Batch M do backlog do diretor — sweepOrphanedRuns fecha runs travados
// (status='running' há muito tempo, sem output_md) como 'error'.

function setupSupabaseMock() {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue(chain);
  const from = vi.fn().mockReturnValue({ update });
  vi.doMock('@/lib/db/supabase', () => ({ getServerSupabase: () => ({ from }) }));
  return { from, update, chain };
}

describe('sweepOrphanedRuns', () => {
  it('updates assistant_runs to status=error, scoped to this user, running, sem output, exclui spend_analysis', async () => {
    const { from, update, chain } = setupSupabaseMock();
    const { sweepOrphanedRuns } = await import('@/lib/assistants/runs');
    await sweepOrphanedRuns('user-1');

    expect(from).toHaveBeenCalledWith('assistant_runs');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error_message: expect.stringMatching(/travad|interromp/i),
        finished_at: expect.any(String),
      }),
    );
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'running');
    expect(chain.is).toHaveBeenCalledWith('output_md', null);
    expect(chain.lt).toHaveBeenCalledWith('created_at', expect.any(String));
    expect(chain.neq).toHaveBeenCalledWith('assistant_type', 'spend_analysis');
  });

  it('the created_at cutoff is in the past (roughly 10 minutes ago)', async () => {
    const { chain } = setupSupabaseMock();
    const { sweepOrphanedRuns } = await import('@/lib/assistants/runs');
    const before = Date.now();
    await sweepOrphanedRuns('user-1');
    const cutoffArg = (chain.lt as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string;
    const cutoffMs = new Date(cutoffArg).getTime();
    expect(cutoffMs).toBeLessThan(before);
    // Não deve ser um cutoff absurdamente distante (ex.: dias) — janela de minutos.
    expect(before - cutoffMs).toBeLessThan(60 * 60 * 1000);
  });

  it('does not throw when the update fails — logs and returns silently', async () => {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.is = vi.fn().mockReturnValue(chain);
    chain.lt = vi.fn().mockReturnValue(chain);
    chain.neq = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    const update = vi.fn().mockReturnValue(chain);
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ update }) }),
    }));
    const { sweepOrphanedRuns } = await import('@/lib/assistants/runs');
    await expect(sweepOrphanedRuns('user-1')).resolves.toBeUndefined();
  });
});
