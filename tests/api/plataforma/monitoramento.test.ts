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
  profiles?: Array<{ id: string; email: string; last_sign_in_at: string | null }>;
  orgs?: Array<{ id: string; status: string }>;
  sessionsCount?: number;
  subs?: Array<{ status: string }>;
  usageEvents?: Array<{ call_count: number; cost_usd_cents: number }>;
  unresolvedFeedback?: number;
  fiscalEnabled?: boolean;
  fiscalHealthy?: boolean;
}) {
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: (table: string) => {
        if (table === 'profiles_with_email') {
          return {
            select: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: opts.profiles ?? [], error: null }),
              }),
            }),
          };
        }
        if (table === 'orgs') {
          return { select: () => Promise.resolve({ data: opts.orgs ?? [], error: null }) };
        }
        if (table === 'sessions') {
          return { select: () => ({ gte: () => Promise.resolve({ count: opts.sessionsCount ?? 0 }) }) };
        }
        if (table === 'subscriptions') {
          return { select: () => Promise.resolve({ data: opts.subs ?? [], error: null }) };
        }
        if (table === 'api_usage_events') {
          return { select: () => ({ gte: () => Promise.resolve({ data: opts.usageEvents ?? [], error: null }) }) };
        }
        // message_feedback
        return {
          select: () => ({
            is: () => ({ eq: () => Promise.resolve({ count: opts.unresolvedFeedback ?? 0 }) }),
          }),
        };
      },
    }),
  }));
  vi.doMock('@/lib/fiscal/client', () => ({
    isFiscalEnabled: () => opts.fiscalEnabled ?? false,
    fiscalHealthcheck: vi.fn().mockResolvedValue(opts.fiscalHealthy ?? false),
  }));
}

describe('GET /api/plataforma/monitoramento', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    mockData({});
    const { GET } = await import('@/app/api/plataforma/monitoramento/route');
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('aggregates KPIs, fiscal health and recent logins', async () => {
    mockAuth(true);
    const now = new Date().toISOString();
    mockData({
      profiles: [
        { id: 'u1', email: 'u1@x.com', last_sign_in_at: now },
        { id: 'u2', email: 'u2@x.com', last_sign_in_at: null },
      ],
      orgs: [{ id: 'o1', status: 'active' }, { id: 'o2', status: 'inactive' }],
      sessionsCount: 5,
      subs: [{ status: 'active' }, { status: 'cancelled' }],
      usageEvents: [
        { call_count: 3, cost_usd_cents: 10 },
        { call_count: 2, cost_usd_cents: 5 },
      ],
      unresolvedFeedback: 2,
      fiscalEnabled: true,
      fiscalHealthy: true,
    });
    const { GET } = await import('@/app/api/plataforma/monitoramento/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      kpis: {
        usersLoggedIn24h: number;
        orgsActive: number;
        totalOrgs: number;
        sessionsActive24h: number;
        payingUsers: number;
        aiCalls24h: number;
        aiCostCents24h: number;
        unresolvedNegativeFeedback: number;
      };
      fiscalService: { enabled: boolean; healthy: boolean | null };
      recentLogins: Array<{ email: string }>;
    };
    expect(body.kpis.usersLoggedIn24h).toBe(1);
    expect(body.kpis.orgsActive).toBe(1);
    expect(body.kpis.totalOrgs).toBe(2);
    expect(body.kpis.sessionsActive24h).toBe(5);
    expect(body.kpis.payingUsers).toBe(1);
    expect(body.kpis.aiCalls24h).toBe(5);
    expect(body.kpis.aiCostCents24h).toBe(15);
    expect(body.kpis.unresolvedNegativeFeedback).toBe(2);
    expect(body.fiscalService).toEqual({ enabled: true, healthy: true });
    expect(body.recentLogins[0]!.email).toBe('u1@x.com');
  });

  it('reports fiscal service as disabled without calling the healthcheck', async () => {
    mockAuth(true);
    mockData({ fiscalEnabled: false });
    const { GET } = await import('@/app/api/plataforma/monitoramento/route');
    const res = await GET();
    const body = (await res.json()) as { fiscalService: { enabled: boolean; healthy: boolean | null } };
    expect(body.fiscalService).toEqual({ enabled: false, healthy: null });
  });
});
