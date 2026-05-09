import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupSupabase(opts: {
  listRows?: unknown[];
  resolveError?: { message: string } | null;
  topRows?: Array<{ content: string; count: number }>;
} = {}) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.is = vi.fn().mockReturnValue(builder);
  builder.not = vi.fn().mockReturnValue(builder);
  builder.gte = vi.fn().mockReturnValue(builder);
  builder.lte = vi.fn().mockReturnValue(builder);
  builder.range = vi.fn().mockResolvedValue({ data: opts.listRows ?? [], error: null });
  builder.update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: opts.resolveError ?? null }),
  });
  const rpcMock = vi.fn().mockResolvedValue({ data: opts.topRows ?? [], error: null });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => builder,
      rpc: rpcMock,
    }),
  }));
  return { builder, rpc: rpcMock };
}

describe('listFeedback', () => {
  it('returns rows with no filters', async () => {
    const m = setupSupabase({
      listRows: [{ id: 'a', rating: 'down', comment: null, created_at: '2026-05-08T00:00:00Z' }],
    });
    const { listFeedback } = await import('@/lib/feedback');
    const out = await listFeedback({ limit: 50, offset: 0 });
    expect(out.rows).toHaveLength(1);
    expect(m.builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('filters by rating', async () => {
    const m = setupSupabase({});
    const { listFeedback } = await import('@/lib/feedback');
    await listFeedback({ rating: 'down', limit: 50, offset: 0 });
    expect(m.builder.eq).toHaveBeenCalledWith('rating', 'down');
  });

  it('filters by resolved=false (only unresolved)', async () => {
    const m = setupSupabase({});
    const { listFeedback } = await import('@/lib/feedback');
    await listFeedback({ resolved: false, limit: 50, offset: 0 });
    expect(m.builder.is).toHaveBeenCalledWith('resolved_at', null);
  });

  it('filters by resolved=true (only resolved)', async () => {
    const m = setupSupabase({});
    const { listFeedback } = await import('@/lib/feedback');
    await listFeedback({ resolved: true, limit: 50, offset: 0 });
    expect(m.builder.not).toHaveBeenCalledWith('resolved_at', 'is', null);
  });

  it('filters by date range', async () => {
    const m = setupSupabase({});
    const { listFeedback } = await import('@/lib/feedback');
    await listFeedback({
      from: '2026-05-01T00:00:00Z',
      to: '2026-05-08T00:00:00Z',
      limit: 50,
      offset: 0,
    });
    expect(m.builder.gte).toHaveBeenCalledWith('created_at', '2026-05-01T00:00:00Z');
    expect(m.builder.lte).toHaveBeenCalledWith('created_at', '2026-05-08T00:00:00Z');
  });
});

describe('resolveFeedback', () => {
  it('sets resolved_at when resolved=true', async () => {
    const m = setupSupabase({});
    const { resolveFeedback } = await import('@/lib/feedback');
    const out = await resolveFeedback('feedback-1', true);
    expect(out.ok).toBe(true);
    expect(m.builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ resolved_at: expect.any(String) }),
    );
  });

  it('clears resolved_at when resolved=false', async () => {
    const m = setupSupabase({});
    const { resolveFeedback } = await import('@/lib/feedback');
    const out = await resolveFeedback('feedback-1', false);
    expect(out.ok).toBe(true);
    expect(m.builder.update).toHaveBeenCalledWith({ resolved_at: null });
  });

  it('returns error on supabase failure', async () => {
    setupSupabase({ resolveError: { message: 'boom' } });
    const { resolveFeedback } = await import('@/lib/feedback');
    const out = await resolveFeedback('feedback-1', true);
    expect(out.ok).toBe(false);
  });
});

describe('topQueries', () => {
  it('returns aggregated rows from rpc', async () => {
    const m = setupSupabase({
      topRows: [
        { content: 'O que é Kraljic?', count: 8 },
        { content: 'Como reduzir custos?', count: 5 },
      ],
    });
    const { topQueries } = await import('@/lib/feedback');
    const out = await topQueries(30, 10);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ content: expect.any(String), count: expect.any(Number) });
    expect(m.rpc).toHaveBeenCalledWith('admin_top_queries', { p_days: 30, p_limit: 10 });
  });

  it('uses default days=30 limit=10 when not specified', async () => {
    const m = setupSupabase({});
    const { topQueries } = await import('@/lib/feedback');
    await topQueries();
    expect(m.rpc).toHaveBeenCalledWith('admin_top_queries', { p_days: 30, p_limit: 10 });
  });
});
