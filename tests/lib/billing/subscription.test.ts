import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

// Mock que aceita resultados separados por tabela. isPro lê profiles + subscriptions;
// getActiveSubscription só lê subscriptions.
function mockSupabase(opts: {
  profile?: Record<string, unknown> | null;
  subscription?: Record<string, unknown> | null;
}) {
  const tableMap: Record<string, Record<string, unknown> | null> = {
    profiles: opts.profile ?? null,
    subscriptions: opts.subscription ?? null,
  };
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: tableMap[table] ?? null, error: null }),
          }),
        }),
      }),
    }),
  }));
}

describe('getActiveSubscription', () => {
  it('returns sub when status=active', async () => {
    mockSupabase({
      subscription: {
        id: 's1',
        user_id: 'u1',
        status: 'active',
        current_period_end: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).not.toBeNull();
  });

  it('returns null when status=pending', async () => {
    mockSupabase({
      subscription: { id: 's1', user_id: 'u1', status: 'pending', current_period_end: null },
    });
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).toBeNull();
  });

  it('returns sub when past_due but period_end is in future', async () => {
    mockSupabase({
      subscription: {
        id: 's1',
        user_id: 'u1',
        status: 'past_due',
        current_period_end: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).not.toBeNull();
  });

  it('returns null when past_due and period_end already passed', async () => {
    mockSupabase({
      subscription: {
        id: 's1',
        user_id: 'u1',
        status: 'past_due',
        current_period_end: new Date(Date.now() - 86400000).toISOString(),
      },
    });
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).toBeNull();
  });

  it('returns null when cancelled', async () => {
    mockSupabase({
      subscription: {
        id: 's1',
        user_id: 'u1',
        status: 'cancelled',
        current_period_end: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).toBeNull();
  });

  it('returns null when no row', async () => {
    mockSupabase({});
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).toBeNull();
  });
});

describe('isPro', () => {
  it('true when active sub exists', async () => {
    mockSupabase({
      profile: { role: 'user' },
      subscription: {
        id: 's1',
        user_id: 'u1',
        status: 'active',
        current_period_end: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const { isPro } = await import('@/lib/billing/subscription');
    expect(await isPro('u1')).toBe(true);
  });

  it('false when no sub and not admin', async () => {
    mockSupabase({ profile: { role: 'user' }, subscription: null });
    const { isPro } = await import('@/lib/billing/subscription');
    expect(await isPro('u1')).toBe(false);
  });

  it('admin bypasses billing — true even without subscription', async () => {
    mockSupabase({ profile: { role: 'admin' }, subscription: null });
    const { isPro } = await import('@/lib/billing/subscription');
    expect(await isPro('admin-1')).toBe(true);
  });

  it('admin bypasses billing — true with cancelled subscription', async () => {
    mockSupabase({
      profile: { role: 'admin' },
      subscription: {
        id: 's1',
        user_id: 'admin-1',
        status: 'cancelled',
        current_period_end: new Date(Date.now() - 1000).toISOString(),
      },
    });
    const { isPro } = await import('@/lib/billing/subscription');
    expect(await isPro('admin-1')).toBe(true);
  });

  it('non-admin without sub returns false (no profile row treated as user)', async () => {
    mockSupabase({ profile: null, subscription: null });
    const { isPro } = await import('@/lib/billing/subscription');
    expect(await isPro('u1')).toBe(false);
  });
});
