import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupMocks(opts: { isAdmin: boolean; rows?: unknown[] }) {
  const listFeedback = vi.fn().mockResolvedValue({ rows: opts.rows ?? [] });
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
  vi.doMock('@/lib/feedback', () => ({ listFeedback }));
  return { listFeedback };
}

function buildReq(qs = ''): Request {
  return new Request(`http://x/api/admin/feedback${qs}`);
}

describe('GET /api/admin/feedback', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { GET } = await import('@/app/api/admin/feedback/route');
    const res = await GET(buildReq());
    expect(res.status).toBe(404);
  });

  it('returns rows with no filters (default limit/offset)', async () => {
    const m = setupMocks({ isAdmin: true, rows: [{ id: 'a' }] });
    const { GET } = await import('@/app/api/admin/feedback/route');
    const res = await GET(buildReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(m.listFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 }),
    );
  });

  it('passes rating filter from query string', async () => {
    const m = setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/route');
    await GET(buildReq('?rating=down'));
    expect(m.listFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 'down' }),
    );
  });

  it('passes resolved=false filter', async () => {
    const m = setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/route');
    await GET(buildReq('?resolved=false'));
    expect(m.listFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ resolved: false }),
    );
  });

  it('passes hasComment=true filter', async () => {
    const m = setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/route');
    await GET(buildReq('?has_comment=true'));
    expect(m.listFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ hasComment: true }),
    );
  });

  it('respects custom limit and offset', async () => {
    const m = setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/route');
    await GET(buildReq('?limit=20&offset=40'));
    expect(m.listFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 40 }),
    );
  });

  it('rejects invalid rating value', async () => {
    setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/route');
    const res = await GET(buildReq('?rating=bogus'));
    expect(res.status).toBe(400);
  });
});
