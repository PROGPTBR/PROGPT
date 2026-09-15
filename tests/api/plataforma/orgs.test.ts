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

function buildReq(body: unknown, method = 'POST'): Request {
  return new Request('http://x/api/plataforma/orgs', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
}

describe('GET /api/plataforma/orgs', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { GET } = await import('@/app/api/plataforma/orgs/route');
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('returns orgs with computed userCount', async () => {
    mockAuth(true);
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: (table: string) => {
          if (table === 'orgs') {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [{ id: 'org-1', name: 'Default', slug: 'progpt-default', status: 'active', template_id: null, org_settings: {}, created_at: '' }],
                    error: null,
                  }),
              }),
            };
          }
          return {
            select: () => Promise.resolve({ data: [{ org_id: 'org-1' }, { org_id: 'org-1' }] }),
          };
        },
      }),
    }));
    const { GET } = await import('@/app/api/plataforma/orgs/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orgs: Array<{ userCount: number }> };
    expect(body.orgs[0]!.userCount).toBe(2);
  });
});

describe('POST /api/plataforma/orgs', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { POST } = await import('@/app/api/plataforma/orgs/route');
    const res = await POST(buildReq({ name: 'X', slug: 'x' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid slug', async () => {
    mockAuth(true);
    const { POST } = await import('@/app/api/plataforma/orgs/route');
    const res = await POST(buildReq({ name: 'X', slug: 'Invalid Slug!' }));
    expect(res.status).toBe(400);
  });

  it('creates an org and returns 201', async () => {
    mockAuth(true);
    const insertedOrg = {
      id: 'org-2',
      name: 'Cliente X',
      slug: 'cliente-x',
      status: 'active',
      template_id: null,
      org_settings: {},
      created_at: '',
    };
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: insertedOrg, error: null }),
            }),
          }),
        }),
      }),
    }));
    const { POST } = await import('@/app/api/plataforma/orgs/route');
    const res = await POST(buildReq({ name: 'Cliente X', slug: 'cliente-x' }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { org: { id: string } };
    expect(body.org.id).toBe('org-2');
  });

  it('returns 409 when slug is already taken', async () => {
    mockAuth(true);
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { code: '23505' } }),
            }),
          }),
        }),
      }),
    }));
    const { POST } = await import('@/app/api/plataforma/orgs/route');
    const res = await POST(buildReq({ name: 'Cliente X', slug: 'cliente-x' }));
    expect(res.status).toBe(409);
  });
});
