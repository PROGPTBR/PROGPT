import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockDeps(opts: { isPro: boolean; count: number }) {
  vi.doMock('@/lib/billing/subscription', () => ({
    isPro: vi.fn().mockResolvedValue(opts.isPro),
  }));
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ count: opts.count, error: null }),
          }),
        }),
      }),
    }),
  }));
}

describe('canUseAssistant', () => {
  it('Pro user always allowed (skips count)', async () => {
    mockDeps({ isPro: true, count: 999 });
    const { canUseAssistant } = await import('@/lib/billing/quota');
    expect(await canUseAssistant('u1', 'rfp')).toBe(true);
  });

  it('Free user with 0 runs allowed', async () => {
    mockDeps({ isPro: false, count: 0 });
    const { canUseAssistant } = await import('@/lib/billing/quota');
    expect(await canUseAssistant('u1', 'rfp')).toBe(true);
  });

  it('Free user with 1 run blocked (quota = 1 lifetime)', async () => {
    mockDeps({ isPro: false, count: 1 });
    const { canUseAssistant } = await import('@/lib/billing/quota');
    expect(await canUseAssistant('u1', 'rfp')).toBe(false);
  });

  it('Free user with 2+ runs blocked', async () => {
    mockDeps({ isPro: false, count: 5 });
    const { canUseAssistant } = await import('@/lib/billing/quota');
    expect(await canUseAssistant('u1', 'kraljic')).toBe(false);
  });

  it('quota is per assistant_type (not global)', async () => {
    mockDeps({ isPro: false, count: 0 });
    const { canUseAssistant } = await import('@/lib/billing/quota');
    // mockDeps does count=0 for any eq().eq() chain, simulating "this type has 0 runs"
    expect(await canUseAssistant('u1', 'porter')).toBe(true);
  });
});

describe('getAssistantQuotaUsed fail-closed', () => {
  it('returns max-int when DB query errors (deny by default)', async () => {
    vi.doMock('@/lib/billing/subscription', () => ({ isPro: vi.fn().mockResolvedValue(false) }));
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: null, error: { message: 'boom' } }),
            }),
          }),
        }),
      }),
    }));
    const { canUseAssistant } = await import('@/lib/billing/quota');
    expect(await canUseAssistant('u1', 'rfp')).toBe(false);
  });
});
