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

function buildPatch(body: unknown): Request {
  return new Request('http://x/api/plataforma/users/u2', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/plataforma/users', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { GET } = await import('@/app/api/plataforma/users/route');
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('joins org info onto each user row', async () => {
    mockAuth(true);
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: (table: string) => {
          if (table === 'profiles_with_email') {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: 'u2',
                        email: 'u2@x.com',
                        role: 'user',
                        display_name: null,
                        org_id: 'org-1',
                        super_admin: false,
                        banned_until: null,
                        created_at: '',
                      },
                    ],
                    error: null,
                  }),
              }),
            };
          }
          return {
            select: () =>
              Promise.resolve({
                data: [{ id: 'org-1', name: 'Default', slug: 'progpt-default' }],
                error: null,
              }),
          };
        },
      }),
    }));
    const { GET } = await import('@/app/api/plataforma/users/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: Array<{ org: { name: string } | null; active: boolean }> };
    expect(body.users[0]!.org?.name).toBe('Default');
    expect(body.users[0]!.active).toBe(true);
  });
});

describe('GET /api/plataforma/users/[id]', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { GET } = await import('@/app/api/plataforma/users/[id]/route');
    const res = await GET(new Request('http://x'), { params: { id: 'u2' } });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the profile is not found', async () => {
    mockAuth(true);
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: (table: string) => {
          if (table === 'profiles_with_email') {
            return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
          }
          return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }), head: true }) };
        },
      }),
    }));
    const { GET } = await import('@/app/api/plataforma/users/[id]/route');
    const res = await GET(new Request('http://x'), { params: { id: 'u2' } });
    expect(res.status).toBe(404);
  });

  it('aggregates profile, org, subscription and usage', async () => {
    mockAuth(true);
    const profileRow = {
      id: 'u2',
      email: 'u2@x.com',
      role: 'user',
      display_name: null,
      org_id: 'org-1',
      super_admin: false,
      banned_until: null,
      created_at: '2026-01-01T00:00:00Z',
      last_sign_in_at: null,
    };
    const subRow = {
      status: 'active',
      plan: 'pro',
      payment_method: 'credit_card',
      trial_end: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
    };
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: (table: string) => {
          if (table === 'profiles_with_email') {
            return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: profileRow, error: null }) }) }) };
          }
          if (table === 'subscriptions') {
            return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: subRow }) }) }) };
          }
          if (table === 'orgs') {
            return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'org-1', name: 'Default', slug: 'progpt-default' } }) }) }) };
          }
          if (table === 'sessions') {
            return { select: () => ({ eq: () => Promise.resolve({ count: 3 }) }) };
          }
          if (table === 'assistant_runs') {
            return { select: () => ({ eq: () => Promise.resolve({ count: 2 }) }) };
          }
          // api_usage_events
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { cost_usd_cents: 10, tokens_in: 100, tokens_out: 20 },
                    { cost_usd_cents: 5, tokens_in: 50, tokens_out: 10 },
                  ],
                }),
            }),
          };
        },
      }),
    }));
    const { GET } = await import('@/app/api/plataforma/users/[id]/route');
    const res = await GET(new Request('http://x'), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      profile: { email: string; active: boolean };
      org: { name: string } | null;
      subscription: { status: string } | null;
      usage: { sessions: number; runs: number; spendCents: number; tokensIn: number; tokensOut: number };
    };
    expect(body.profile.email).toBe('u2@x.com');
    expect(body.profile.active).toBe(true);
    expect(body.org?.name).toBe('Default');
    expect(body.subscription?.status).toBe('active');
    expect(body.usage).toEqual({ sessions: 3, runs: 2, spendCents: 15, tokensIn: 150, tokensOut: 30 });
  });
});

describe('PATCH /api/plataforma/users/[id]', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { PATCH } = await import('@/app/api/plataforma/users/[id]/route');
    const res = await PATCH(buildPatch({ superAdmin: true }), { params: { id: 'u2' } });
    expect(res.status).toBe(404);
  });

  it('returns 400 for empty body', async () => {
    mockAuth(true);
    const { PATCH } = await import('@/app/api/plataforma/users/[id]/route');
    const res = await PATCH(buildPatch({}), { params: { id: 'u2' } });
    expect(res.status).toBe(400);
  });

  it('refuses self super_admin revocation', async () => {
    mockAuth(true, 'admin-1');
    const { PATCH } = await import('@/app/api/plataforma/users/[id]/route');
    const res = await PATCH(buildPatch({ superAdmin: false }), { params: { id: 'admin-1' } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('cannot_revoke_self');
  });

  it('grants super_admin via service-role update', async () => {
    mockAuth(true);
    const update = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ update }) }),
    }));
    const { PATCH } = await import('@/app/api/plataforma/users/[id]/route');
    const res = await PATCH(buildPatch({ superAdmin: true }), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ super_admin: true });
  });

  it('moves a user to a different org', async () => {
    mockAuth(true);
    const update = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ update }) }),
    }));
    const { PATCH } = await import('@/app/api/plataforma/users/[id]/route');
    const orgId = '00000000-0000-0000-0000-000000000002';
    const res = await PATCH(buildPatch({ orgId }), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ org_id: orgId });
  });

  it('changes a user role via service-role update', async () => {
    mockAuth(true);
    const update = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ update }) }),
    }));
    const { PATCH } = await import('@/app/api/plataforma/users/[id]/route');
    const res = await PATCH(buildPatch({ role: 'gestor' }), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ role: 'gestor' });
  });

  it('refuses editing your own role via this endpoint', async () => {
    mockAuth(true, 'admin-1');
    const { PATCH } = await import('@/app/api/plataforma/users/[id]/route');
    const res = await PATCH(buildPatch({ role: 'user' }), { params: { id: 'admin-1' } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('cannot_edit_own_role');
  });
});
