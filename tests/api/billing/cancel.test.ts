import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(authed: boolean, userId = 'u1') {
  vi.doMock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>();
    return {
      ...actual,
      requireUser: vi.fn().mockImplementation(async () => {
        if (!authed) throw new (actual.NotAuthenticated)();
        return { id: userId, email: 'me@x.com' };
      }),
    };
  });
}

function mockDeps(opts: {
  sub?: Record<string, unknown> | null;
  cancelThrows?: boolean;
}) {
  vi.doMock('@/lib/billing/subscription', () => ({
    getSubscription: vi.fn().mockResolvedValue(opts.sub ?? null),
  }));
  vi.doMock('@/lib/billing/asaas', () => ({
    cancelAsaasSubscription: vi.fn().mockImplementation(async () => {
      if (opts.cancelThrows) throw new Error('asaas down');
    }),
    AsaasError: class AsaasError extends Error {
      constructor(msg: string, public status: number) {
        super(msg);
      }
    },
  }));
  const subUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({ from: () => ({ update: subUpdate }) }),
  }));
  return { subUpdate };
}

async function POST_call() {
  const { POST } = await import('@/app/api/billing/cancel/route');
  return POST();
}

describe('POST /api/billing/cancel', () => {
  it('401 when not authenticated', async () => {
    mockAuth(false);
    mockDeps({});
    const res = await POST_call();
    expect(res.status).toBe(401);
  });

  it('404 when no subscription exists', async () => {
    mockAuth(true);
    mockDeps({ sub: null });
    const res = await POST_call();
    expect(res.status).toBe(404);
  });

  it('409 when already cancelled', async () => {
    mockAuth(true);
    mockDeps({
      sub: {
        id: 's1',
        asaas_subscription_id: 'sub_x',
        status: 'cancelled',
      },
    });
    const res = await POST_call();
    expect(res.status).toBe(409);
  });

  it('200 success + marks cancel_at_period_end true', async () => {
    mockAuth(true);
    const { subUpdate } = mockDeps({
      sub: {
        id: 's1',
        asaas_subscription_id: 'sub_x',
        status: 'active',
        current_period_end: '2026-06-27T00:00:00Z',
      },
    });
    const res = await POST_call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessUntil).toBe('2026-06-27T00:00:00Z');
    expect(subUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ cancel_at_period_end: true }),
    );
  });
});
