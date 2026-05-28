import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockSupabase(sub: Record<string, unknown> | null) {
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: sub, error: null }) }),
        }),
      }),
    }),
  }));
}

describe('getActiveSubscription', () => {
  it('returns sub when status=active', async () => {
    mockSupabase({
      id: 's1',
      user_id: 'u1',
      status: 'active',
      current_period_end: new Date(Date.now() + 86400000).toISOString(),
    });
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).not.toBeNull();
  });

  it('returns null when status=pending', async () => {
    mockSupabase({ id: 's1', user_id: 'u1', status: 'pending', current_period_end: null });
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).toBeNull();
  });

  it('returns sub when past_due but period_end is in future', async () => {
    mockSupabase({
      id: 's1',
      user_id: 'u1',
      status: 'past_due',
      current_period_end: new Date(Date.now() + 86400000).toISOString(),
    });
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).not.toBeNull();
  });

  it('returns null when past_due and period_end already passed', async () => {
    mockSupabase({
      id: 's1',
      user_id: 'u1',
      status: 'past_due',
      current_period_end: new Date(Date.now() - 86400000).toISOString(),
    });
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).toBeNull();
  });

  it('returns null when cancelled', async () => {
    mockSupabase({
      id: 's1',
      user_id: 'u1',
      status: 'cancelled',
      current_period_end: new Date(Date.now() + 86400000).toISOString(),
    });
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).toBeNull();
  });

  it('returns null when no row', async () => {
    mockSupabase(null);
    const { getActiveSubscription } = await import('@/lib/billing/subscription');
    expect(await getActiveSubscription('u1')).toBeNull();
  });
});

describe('isPro', () => {
  it('true when active sub exists', async () => {
    mockSupabase({
      id: 's1',
      user_id: 'u1',
      status: 'active',
      current_period_end: new Date(Date.now() + 86400000).toISOString(),
    });
    const { isPro } = await import('@/lib/billing/subscription');
    expect(await isPro('u1')).toBe(true);
  });

  it('false when no sub', async () => {
    mockSupabase(null);
    const { isPro } = await import('@/lib/billing/subscription');
    expect(await isPro('u1')).toBe(false);
  });
});
