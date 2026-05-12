import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

type Opts = {
  isAdmin: boolean;
  movedIds?: string[];
  selectError?: { message: string } | null;
};

function setupMocks(opts: Opts) {
  const select = vi.fn().mockResolvedValue({
    data: (opts.movedIds ?? []).map((id) => ({ id })),
    error: opts.selectError ?? null,
  });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
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
  return { update, eq };
}

function buildReq(body: unknown): Request {
  return new Request('http://x/api/admin/themes/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/themes/rename', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { POST } = await import('@/app/api/admin/themes/rename/route');
    const res = await POST(buildReq({ from: 'A', to: 'B' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing fields', async () => {
    setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/themes/rename/route');
    const res = await POST(buildReq({ from: 'A' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when from === to (noop)', async () => {
    setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/themes/rename/route');
    const res = await POST(buildReq({ from: 'Kraljic', to: 'Kraljic' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('noop');
  });

  it('renames to a non-canonical name → status candidate', async () => {
    const m = setupMocks({ isAdmin: true, movedIds: ['x', 'y'] });
    const { POST } = await import('@/app/api/admin/themes/rename/route');
    const res = await POST(buildReq({ from: 'Outros', to: 'Gestão de Projetos' }));
    expect(res.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith({
      theme: 'Gestão de Projetos',
      theme_status: 'candidate',
    });
    expect(m.eq).toHaveBeenCalledWith('theme', 'Outros');
    const body = (await res.json()) as { moved: number; newStatus: string };
    expect(body).toMatchObject({ moved: 2, newStatus: 'candidate' });
  });

  it('renames to a canonical name → status canonical (derived server-side)', async () => {
    const m = setupMocks({ isAdmin: true, movedIds: ['x'] });
    const { POST } = await import('@/app/api/admin/themes/rename/route');
    const res = await POST(buildReq({ from: 'Cadeia de Suprimentos', to: 'Sourcing Estratégico' }));
    expect(res.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith({
      theme: 'Sourcing Estratégico',
      theme_status: 'canonical',
    });
  });

  it('normalizes whitespace/quotes in both from and to', async () => {
    const m = setupMocks({ isAdmin: true, movedIds: [] });
    const { POST } = await import('@/app/api/admin/themes/rename/route');
    const res = await POST(buildReq({ from: '  "Outros"  ', to: '  Gestão  de Projetos  ' }));
    expect(res.status).toBe(200);
    expect(m.eq).toHaveBeenCalledWith('theme', 'Outros');
    expect(m.update).toHaveBeenCalledWith({
      theme: 'Gestão de Projetos',
      theme_status: 'candidate',
    });
  });

  it('returns 500 on supabase error', async () => {
    setupMocks({ isAdmin: true, selectError: { message: 'boom' } });
    const { POST } = await import('@/app/api/admin/themes/rename/route');
    const res = await POST(buildReq({ from: 'A', to: 'B' }));
    expect(res.status).toBe(500);
  });
});
