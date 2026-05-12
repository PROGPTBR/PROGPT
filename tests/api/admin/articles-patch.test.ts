import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupMocks(opts: { isAdmin: boolean; supabaseError?: { message: string } | null }) {
  const updateChain = {
    eq: vi.fn().mockResolvedValue({ error: opts.supabaseError ?? null }),
  };
  const update = vi.fn().mockReturnValue(updateChain);
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
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({ from: () => ({ update }) }),
  }));
  return { update, updateChain };
}

function buildReq(body: unknown): Request {
  return new Request('http://x/api/admin/articles/abc', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/admin/articles/[id]', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const res = await PATCH(buildReq({ title: 'New title here' }), { params: { id: 'abc' } });
    expect(res.status).toBe(404);
  });

  it('returns 400 when body is empty (no fields)', async () => {
    setupMocks({ isAdmin: true });
    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const res = await PATCH(buildReq({}), { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('accepts a non-canonical theme as candidate (open taxonomy)', async () => {
    const m = setupMocks({ isAdmin: true });
    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const res = await PATCH(
      buildReq({ theme: 'Gestão de Projetos' }),
      { params: { id: 'abc' } },
    );
    expect(res.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith({
      theme: 'Gestão de Projetos',
      theme_status: 'candidate',
    });
    const body = (await res.json()) as { themeStatus?: string };
    expect(body.themeStatus).toBe('candidate');
  });

  it('returns 400 when theme is empty after trim', async () => {
    setupMocks({ isAdmin: true });
    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const res = await PATCH(buildReq({ theme: '   ' }), { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('returns 400 when theme exceeds the length cap', async () => {
    setupMocks({ isAdmin: true });
    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const long = 'x'.repeat(60);
    // After normalization the string is still >50 chars (no trim/collapse changes it)
    const res = await PATCH(buildReq({ theme: long }), { params: { id: 'abc' } });
    // Validator accepts up to MAX_THEME_LENGTH=50; longer fails refine
    expect(res.status).toBe(400);
  });

  it('returns 400 when title is too short', async () => {
    setupMocks({ isAdmin: true });
    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const res = await PATCH(buildReq({ title: 'ab' }), { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('updates with title only', async () => {
    const m = setupMocks({ isAdmin: true });
    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const res = await PATCH(
      buildReq({ title: 'Title that is long enough' }),
      { params: { id: 'abc' } },
    );
    expect(res.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith({ title: 'Title that is long enough' });
  });

  it('updates with theme only and derives theme_status=canonical', async () => {
    const m = setupMocks({ isAdmin: true });
    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const res = await PATCH(buildReq({ theme: 'Kraljic' }), { params: { id: 'abc' } });
    expect(res.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith({ theme: 'Kraljic', theme_status: 'canonical' });
    const body = (await res.json()) as { themeStatus?: string };
    expect(body.themeStatus).toBe('canonical');
  });

  it('returns 500 when supabase update errors', async () => {
    setupMocks({ isAdmin: true, supabaseError: { message: 'boom' } });
    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const res = await PATCH(buildReq({ theme: 'Kraljic' }), { params: { id: 'abc' } });
    expect(res.status).toBe(500);
  });
});
