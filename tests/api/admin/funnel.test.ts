import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

type Opts = {
  isAdmin: boolean;
  rpcData?: Record<string, unknown>;
  rpcError?: { message: string };
};

function setupMocks(opts: Opts) {
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: opts.rpcData ?? null, error: opts.rpcError ?? null });
  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error {
      constructor() {
        super('not admin');
        this.name = 'NotAdmin';
      }
    }
    return {
      requireAdmin: vi.fn().mockImplementation(() => {
        if (!opts.isAdmin) throw new NotAdmin();
      }),
      NotAdmin,
    };
  });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({ rpc }),
  }));
  return { rpc };
}

describe('GET /api/admin/funnel', () => {
  it('returns 404 for non-admin (não revela o endpoint)', async () => {
    setupMocks({ isAdmin: false });
    const { GET } = await import('@/app/api/admin/funnel/route');
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('returns 500 when rpc errors', async () => {
    setupMocks({ isAdmin: true, rpcError: { message: 'boom' } });
    const { GET } = await import('@/app/api/admin/funnel/route');
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it('forwards the metrics object on happy path', async () => {
    const metrics = {
      signups_total: 42,
      signups_7d: 5,
      signups_30d: 20,
      activated_total: 30,
      activated_assistants: 18,
      activated_chat: 25,
      paid_active: 3,
      paid_cancelled: 1,
      by_assistant: [
        { assistant_type: 'rfp', runs: 12, distinct_users: 8, done: 11, errored: 1 },
      ],
    };
    const { rpc } = setupMocks({ isAdmin: true, rpcData: metrics });
    const { GET } = await import('@/app/api/admin/funnel/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(metrics);
    expect(rpc).toHaveBeenCalledWith('admin_funnel_metrics');
  });
});
