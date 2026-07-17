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

describe('subscriptionGrantsAccess', () => {
  const future = () => new Date(Date.now() + 86400000).toISOString();
  const past = () => new Date(Date.now() - 86400000).toISOString();

  function base(over: Record<string, unknown>) {
    return {
      id: 's1',
      user_id: 'u1',
      asaas_customer_id: null,
      asaas_subscription_id: null,
      status: 'active',
      plan: 'pro',
      payment_method: 'credit_card',
      current_period_start: null,
      current_period_end: null,
      trial_end: null,
      cancel_at_period_end: false,
      cancelled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...over,
    } as Parameters<
      typeof import('@/lib/billing/subscription').subscriptionGrantsAccess
    >[0];
  }

  it('grants access while trialing within trial_end', async () => {
    const { subscriptionGrantsAccess } = await import('@/lib/billing/subscription');
    expect(subscriptionGrantsAccess(base({ status: 'trialing', trial_end: future() }))).toBe(true);
  });

  it('cancel_at_period_end during trial keeps access until trial_end', async () => {
    // Webhook do Asaas já flipou status p/ 'cancelled' na hora do DELETE, mas
    // como foi cancelamento do usuário (cancel_at_period_end) e ainda estamos
    // dentro do trial, o acesso é mantido — promessa da UI.
    const { subscriptionGrantsAccess } = await import('@/lib/billing/subscription');
    expect(
      subscriptionGrantsAccess(
        base({ status: 'cancelled', cancel_at_period_end: true, trial_end: future() }),
      ),
    ).toBe(true);
  });

  it('cancel_at_period_end on paid sub keeps access until current_period_end', async () => {
    const { subscriptionGrantsAccess } = await import('@/lib/billing/subscription');
    expect(
      subscriptionGrantsAccess(
        base({ status: 'cancelled', cancel_at_period_end: true, current_period_end: future() }),
      ),
    ).toBe(true);
  });

  it('cancel_at_period_end revokes access once the period/trial ended', async () => {
    const { subscriptionGrantsAccess } = await import('@/lib/billing/subscription');
    expect(
      subscriptionGrantsAccess(
        base({ status: 'cancelled', cancel_at_period_end: true, trial_end: past() }),
      ),
    ).toBe(false);
  });

  it('cancelled WITHOUT cancel_at_period_end (refund/payment-deleted) revokes access immediately', async () => {
    const { subscriptionGrantsAccess } = await import('@/lib/billing/subscription');
    expect(
      subscriptionGrantsAccess(
        base({ status: 'cancelled', cancel_at_period_end: false, current_period_end: future() }),
      ),
    ).toBe(false);
  });
});

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
