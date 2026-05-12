import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

type Opts = {
  isAdmin: boolean;
  demotedIds?: string[];
  selectError?: { message: string } | null;
};

function setupMocks(opts: Opts) {
  const select = vi.fn().mockResolvedValue({
    data: (opts.demotedIds ?? []).map((id) => ({ id })),
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
  vi.doMock('@/lib/db/supabase-server', () => ({
    supabaseServer: () => ({ from: () => ({ update }) }),
  }));
  return { update, eq1, eq2 };
}

function buildReq(body: unknown): Request {
  return new Request('http://x/api/admin/themes/demote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/themes/demote', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { POST } = await import('@/app/api/admin/themes/demote/route');
    const res = await POST(buildReq({ theme: 'X' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing theme', async () => {
    setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/themes/demote/route');
    const res = await POST(buildReq({}));
    expect(res.status).toBe(400);
  });

  it('refuses to demote a theme listed in CANONICAL_THEMES (would create split-brain with classifier)', async () => {
    setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/themes/demote/route');
    const res = await POST(buildReq({ theme: 'Kraljic' }));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('protected_canonical');
  });

  it('demotes a non-constant canonical theme', async () => {
    const m = setupMocks({ isAdmin: true, demotedIds: ['a', 'b'] });
    const { POST } = await import('@/app/api/admin/themes/demote/route');
    const res = await POST(buildReq({ theme: 'Custom Theme' }));
    expect(res.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith({ theme_status: 'candidate' });
    expect(m.eq1).toHaveBeenCalledWith('theme', 'Custom Theme');
    expect(m.eq2).toHaveBeenCalledWith('theme_status', 'canonical');
    const body = (await res.json()) as { demoted: number };
    expect(body.demoted).toBe(2);
  });

  it('returns 200 with demoted=0 when no rows match', async () => {
    setupMocks({ isAdmin: true, demotedIds: [] });
    const { POST } = await import('@/app/api/admin/themes/demote/route');
    const res = await POST(buildReq({ theme: 'No Such Theme' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { demoted: number };
    expect(body.demoted).toBe(0);
  });

  it('returns 500 on supabase error', async () => {
    setupMocks({ isAdmin: true, selectError: { message: 'boom' } });
    const { POST } = await import('@/app/api/admin/themes/demote/route');
    const res = await POST(buildReq({ theme: 'Custom' }));
    expect(res.status).toBe(500);
  });
});
