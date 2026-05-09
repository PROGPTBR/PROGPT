import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupMocks(opts: { isAdmin: boolean; rows?: Array<{ content: string; count: number }> }) {
  const topQueries = vi.fn().mockResolvedValue(opts.rows ?? []);
  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error {
      constructor() { super('not admin'); this.name = 'NotAdmin'; }
    }
    return {
      requireAdmin: vi.fn().mockImplementation(() => {
        if (!opts.isAdmin) throw new NotAdmin();
      }),
      NotAdmin,
    };
  });
  vi.doMock('@/lib/feedback', () => ({ topQueries }));
  return { topQueries };
}

function buildReq(qs = ''): Request {
  return new Request(`http://x/api/admin/feedback/top-queries${qs}`);
}

describe('GET /api/admin/feedback/top-queries', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { GET } = await import('@/app/api/admin/feedback/top-queries/route');
    const res = await GET(buildReq());
    expect(res.status).toBe(404);
  });

  it('returns rows with default days/limit', async () => {
    const m = setupMocks({
      isAdmin: true,
      rows: [{ content: 'q1', count: 10 }, { content: 'q2', count: 5 }],
    });
    const { GET } = await import('@/app/api/admin/feedback/top-queries/route');
    const res = await GET(buildReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(2);
    expect(m.topQueries).toHaveBeenCalledWith(30, 10);
  });

  it('respects custom days and limit', async () => {
    const m = setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/top-queries/route');
    await GET(buildReq('?days=7&limit=5'));
    expect(m.topQueries).toHaveBeenCalledWith(7, 5);
  });

  it('rejects invalid days (negative)', async () => {
    setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/top-queries/route');
    const res = await GET(buildReq('?days=-1'));
    expect(res.status).toBe(400);
  });
});
