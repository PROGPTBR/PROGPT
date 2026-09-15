import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(isSuperAdmin: boolean) {
  vi.doMock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>();
    return {
      ...actual,
      requireSuperAdmin: vi.fn().mockImplementation(async () => {
        if (!isSuperAdmin) throw new (actual.NotSuperAdmin)();
        return {
          user: { id: 'admin-1', email: 'a@b.com' } as unknown,
          profile: { id: 'admin-1', role: 'admin', display_name: null, super_admin: true },
        };
      }),
    };
  });
}

function mockData(opts: {
  profiles?: Array<{ id: string; email: string }>;
  orgs?: unknown[];
  templates?: unknown[];
  subs?: Array<{ user_id: string; status: string; plan: string; current_period_end: string | null; trial_end: string | null }>;
  auditRows?: unknown[];
}) {
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: (table: string) => {
        if (table === 'profiles_with_email') {
          return { select: () => Promise.resolve({ data: opts.profiles ?? [], error: null }) };
        }
        if (table === 'orgs') {
          return { select: () => Promise.resolve({ data: opts.orgs ?? [], error: null }) };
        }
        if (table === 'plataforma_templates') {
          return { select: () => Promise.resolve({ data: opts.templates ?? [], error: null }) };
        }
        if (table === 'subscriptions') {
          return { select: () => Promise.resolve({ data: opts.subs ?? [], error: null }) };
        }
        // audit_log
        return {
          select: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: opts.auditRows ?? [], error: null }),
            }),
          }),
        };
      },
    }),
  }));
}

describe('GET /api/plataforma/console', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    mockData({});
    const { GET } = await import('@/app/api/plataforma/console/route');
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('aggregates KPIs, alerts and recent activity', async () => {
    mockAuth(true);
    mockData({
      profiles: [{ id: 'u1', email: 'u1@x.com' }, { id: 'u2', email: 'u2@x.com' }],
      orgs: [{ id: 'org-1' }],
      templates: [{ id: 't1' }],
      subs: [
        { user_id: 'u1', status: 'past_due', plan: 'pro', current_period_end: null, trial_end: null },
        {
          user_id: 'u2',
          status: 'trialing',
          plan: 'pro',
          current_period_end: null,
          trial_end: new Date(Date.now() + 3600_000).toISOString(),
        },
      ],
      auditRows: [
        {
          id: 'log-1',
          actor_email: 'admin@x.com',
          action: 'user.role_change',
          resource_type: 'profile',
          resource_id: 'u1',
          created_at: '2026-09-15T00:00:00Z',
        },
      ],
    });
    const { GET } = await import('@/app/api/plataforma/console/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      kpis: { totalOrgs: number; totalUsers: number; payingUsers: number; totalTemplates: number };
      alerts: { pastDue: Array<{ userId: string }>; trialEndingSoon: Array<{ userId: string }> };
      recentActivity: Array<{ action: string }>;
    };
    expect(body.kpis).toEqual({ totalOrgs: 1, totalUsers: 2, payingUsers: 2, totalTemplates: 1 });
    expect(body.alerts.pastDue).toHaveLength(1);
    expect(body.alerts.pastDue[0]!.userId).toBe('u1');
    expect(body.alerts.trialEndingSoon).toHaveLength(1);
    expect(body.alerts.trialEndingSoon[0]!.userId).toBe('u2');
    expect(body.recentActivity).toHaveLength(1);
    expect(body.recentActivity[0]!.action).toBe('user.role_change');
  });
});
