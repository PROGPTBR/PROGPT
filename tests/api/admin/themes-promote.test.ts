import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

type MockOpts = {
  isAdmin: boolean;
  selectError?: { message: string } | null;
  promotedIds?: string[];
};

function setupMocks(opts: MockOpts) {
  // Chain: from('articles').update({theme_status}).eq(...).eq(...).select('id')
  const select = vi
    .fn()
    .mockResolvedValue({
      data: (opts.promotedIds ?? []).map((id) => ({ id })),
      error: opts.selectError ?? null,
    });
  const eq2 = vi.fn().mockReturnValue({ select });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const update = vi.fn().mockReturnValue({ eq: eq1 });
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
    getServerSupabase: () => ({ from: () => ({ update }) }),
  }));
  return { update, eq1, eq2, select };
}

function buildReq(body: unknown): Request {
  return new Request('http://x/api/admin/themes/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/themes/promote', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { POST } = await import('@/app/api/admin/themes/promote/route');
    const res = await POST(buildReq({ theme: 'Gestão de Projetos' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 for empty body', async () => {
    setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/themes/promote/route');
    const res = await POST(buildReq({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty theme after trim', async () => {
    setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/themes/promote/route');
    const res = await POST(buildReq({ theme: '   ' }));
    expect(res.status).toBe(400);
  });

  it('promotes a candidate theme and returns the count of affected rows', async () => {
    const m = setupMocks({ isAdmin: true, promotedIds: ['a', 'b', 'c'] });
    const { POST } = await import('@/app/api/admin/themes/promote/route');
    const res = await POST(buildReq({ theme: 'Gestão de Projetos' }));
    expect(res.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith({ theme_status: 'canonical' });
    // First .eq filters by theme name; second .eq scopes to candidates so we
    // never accidentally re-flip a row that was already canonical.
    expect(m.eq1).toHaveBeenCalledWith('theme', 'Gestão de Projetos');
    expect(m.eq2).toHaveBeenCalledWith('theme_status', 'candidate');
    const body = (await res.json()) as { ok: boolean; promoted: number };
    expect(body).toEqual({ ok: true, promoted: 3 });
  });

  it('returns 200 with promoted=0 when no candidate rows exist for the theme', async () => {
    setupMocks({ isAdmin: true, promotedIds: [] });
    const { POST } = await import('@/app/api/admin/themes/promote/route');
    const res = await POST(buildReq({ theme: 'Inexistente' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { promoted: number };
    expect(body.promoted).toBe(0);
  });

  it('returns 500 when supabase errors', async () => {
    setupMocks({ isAdmin: true, selectError: { message: 'boom' } });
    const { POST } = await import('@/app/api/admin/themes/promote/route');
    const res = await POST(buildReq({ theme: 'Gestão de Projetos' }));
    expect(res.status).toBe(500);
  });
});
