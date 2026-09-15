import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(isSuperAdmin: boolean, userId = 'admin-1') {
  vi.doMock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>();
    return {
      ...actual,
      requireSuperAdmin: vi.fn().mockImplementation(async () => {
        if (!isSuperAdmin) throw new (actual.NotSuperAdmin)();
        return {
          user: { id: userId, email: 'a@b.com' } as unknown,
          profile: { id: userId, role: 'admin', display_name: null, super_admin: true },
        };
      }),
    };
  });
  vi.doMock('@/lib/observability/audit-log', () => ({ recordAuditLog: vi.fn() }));
}

function buildReq(body: unknown, method: string): Request {
  return new Request('http://x/api/plataforma/templates', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body),
  });
}

describe('GET /api/plataforma/templates', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { GET } = await import('@/app/api/plataforma/templates/route');
    const res = await GET();
    expect(res.status).toBe(404);
  });
});

describe('POST /api/plataforma/templates', () => {
  it('returns 400 for invalid slug', async () => {
    mockAuth(true);
    const { POST } = await import('@/app/api/plataforma/templates/route');
    const res = await POST(buildReq({ name: 'Padrão', slug: 'Not Valid' }, 'POST'));
    expect(res.status).toBe(400);
  });

  it('creates a template and returns 201', async () => {
    mockAuth(true);
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 't-1',
                    slug: 'padrao',
                    name: 'Padrão',
                    description: '',
                    config: {},
                    is_active: true,
                    created_at: '',
                    updated_at: '',
                  },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    }));
    const { POST } = await import('@/app/api/plataforma/templates/route');
    const res = await POST(buildReq({ name: 'Padrão', slug: 'padrao' }, 'POST'));
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/plataforma/templates/[id]', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { PATCH } = await import('@/app/api/plataforma/templates/[id]/route');
    const res = await PATCH(buildReq({ config: {} }, 'PATCH'), { params: { id: 't-1' } });
    expect(res.status).toBe(404);
  });

  it('returns 400 for empty body', async () => {
    mockAuth(true);
    const { PATCH } = await import('@/app/api/plataforma/templates/[id]/route');
    const res = await PATCH(buildReq({}, 'PATCH'), { params: { id: 't-1' } });
    expect(res.status).toBe(400);
  });

  it('updates config on the happy path', async () => {
    mockAuth(true);
    const update = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ update }) }),
    }));
    const { PATCH } = await import('@/app/api/plataforma/templates/[id]/route');
    const res = await PATCH(buildReq({ config: { enabledAssistants: ['kraljic'] } }, 'PATCH'), {
      params: { id: 't-1' },
    });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/plataforma/templates/[id]', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { DELETE } = await import('@/app/api/plataforma/templates/[id]/route');
    const res = await DELETE(buildReq(undefined, 'DELETE'), { params: { id: 't-1' } });
    expect(res.status).toBe(404);
  });

  it('deletes and returns 204', async () => {
    mockAuth(true);
    const del = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ delete: del }) }),
    }));
    const { DELETE } = await import('@/app/api/plataforma/templates/[id]/route');
    const res = await DELETE(buildReq(undefined, 'DELETE'), { params: { id: 't-1' } });
    expect(res.status).toBe(204);
  });
});
