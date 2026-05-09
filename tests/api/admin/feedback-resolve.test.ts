import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupMocks(opts: { isAdmin: boolean; resolveResult?: { ok: boolean; resolved_at: string | null } }) {
  const resolveFeedback = vi.fn().mockResolvedValue(
    opts.resolveResult ?? { ok: true, resolved_at: '2026-05-08T00:00:00Z' },
  );
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
  vi.doMock('@/lib/feedback', () => ({ resolveFeedback }));
  return { resolveFeedback };
}

function buildReq(body: unknown): Request {
  return new Request('http://x/api/admin/feedback/abc/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/feedback/[id]/resolve', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { POST } = await import('@/app/api/admin/feedback/[id]/resolve/route');
    const res = await POST(buildReq({ resolved: true }), { params: { id: 'abc' } });
    expect(res.status).toBe(404);
  });

  it('marks feedback as resolved', async () => {
    const m = setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/feedback/[id]/resolve/route');
    const res = await POST(buildReq({ resolved: true }), { params: { id: 'abc' } });
    expect(res.status).toBe(200);
    expect(m.resolveFeedback).toHaveBeenCalledWith('abc', true);
  });

  it('clears resolved when resolved=false', async () => {
    const m = setupMocks({ isAdmin: true, resolveResult: { ok: true, resolved_at: null } });
    const { POST } = await import('@/app/api/admin/feedback/[id]/resolve/route');
    await POST(buildReq({ resolved: false }), { params: { id: 'abc' } });
    expect(m.resolveFeedback).toHaveBeenCalledWith('abc', false);
  });

  it('returns 400 for missing resolved field', async () => {
    setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/feedback/[id]/resolve/route');
    const res = await POST(buildReq({}), { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('returns 500 when supabase update fails', async () => {
    setupMocks({ isAdmin: true, resolveResult: { ok: false, resolved_at: null } });
    const { POST } = await import('@/app/api/admin/feedback/[id]/resolve/route');
    const res = await POST(buildReq({ resolved: true }), { params: { id: 'abc' } });
    expect(res.status).toBe(500);
  });
});
