import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

type Opts = {
  isAdmin: boolean;
  rpcData?: Array<Record<string, unknown>>;
  rpcError?: { message: string };
};

function setupMocks(opts: Opts) {
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: opts.rpcData ?? [], error: opts.rpcError ?? null });
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

function buildReq(url: string): Request {
  return new Request(url, { method: 'GET' });
}

describe('GET /api/admin/costs', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { GET } = await import('@/app/api/admin/costs/route');
    const res = await GET(buildReq('http://x/api/admin/costs'));
    expect(res.status).toBe(404);
  });

  it('returns 500 when rpc errors', async () => {
    setupMocks({ isAdmin: true, rpcError: { message: 'boom' } });
    const { GET } = await import('@/app/api/admin/costs/route');
    const res = await GET(buildReq('http://x/api/admin/costs'));
    expect(res.status).toBe(500);
  });

  it('aggregates totals across daily rows', async () => {
    setupMocks({
      isAdmin: true,
      rpcData: [
        {
          day: '2026-05-12',
          provider: 'openai',
          operation: 'chat-generate',
          call_count: 5,
          tokens_in: 1000,
          tokens_out: 500,
          tokens_cached: 200,
          cost_usd_cents: '0.5',
        },
        {
          day: '2026-05-11',
          provider: 'voyage',
          operation: 'embed',
          call_count: 2,
          tokens_in: 300,
          tokens_out: 0,
          tokens_cached: 0,
          cost_usd_cents: '0.05',
        },
      ],
    });
    const { GET } = await import('@/app/api/admin/costs/route');
    const res = await GET(buildReq('http://x/api/admin/costs'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      totals: Record<string, number>;
      daily: Array<Record<string, unknown>>;
      rangeDays: number;
    };
    expect(body.totals).toMatchObject({
      callCount: 7,
      tokensIn: 1300,
      tokensOut: 500,
      tokensCached: 200,
    });
    expect(body.totals.costUsdCents).toBeCloseTo(0.55, 4);
    expect(body.daily).toHaveLength(2);
    expect(body.rangeDays).toBe(30);
  });

  it('respects ?range=7 and rejects unknown ranges (falls back to 30)', async () => {
    const m1 = setupMocks({ isAdmin: true, rpcData: [] });
    const { GET } = await import('@/app/api/admin/costs/route');
    await GET(buildReq('http://x/api/admin/costs?range=7'));
    expect(m1.rpc).toHaveBeenCalledWith('admin_api_usage_daily', { p_days: 7 });

    vi.resetModules();
    const m2 = setupMocks({ isAdmin: true, rpcData: [] });
    const { GET: GET2 } = await import('@/app/api/admin/costs/route');
    await GET2(buildReq('http://x/api/admin/costs?range=12345'));
    // 12345 is not in ALLOWED_RANGES so it falls back to 30
    expect(m2.rpc).toHaveBeenCalledWith('admin_api_usage_daily', { p_days: 30 });
  });
});
