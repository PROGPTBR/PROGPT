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

describe('canTakeNegotiationTurn', () => {
  function mockIsPro(isPro: boolean) {
    vi.doMock('@/lib/billing/subscription', () => ({
      isPro: vi.fn().mockResolvedValue(isPro),
    }));
  }

  it('free user allowed at exactly the cap (30 turns)', async () => {
    mockIsPro(false);
    const { canTakeNegotiationTurn, FREE_NEGOTIATION_TURN_CAP } = await import('@/lib/billing/quota');
    expect(FREE_NEGOTIATION_TURN_CAP).toBe(30);
    expect(await canTakeNegotiationTurn('u1', 30)).toBe(true);
  });

  it('free user blocked past the cap (31 turns)', async () => {
    mockIsPro(false);
    const { canTakeNegotiationTurn } = await import('@/lib/billing/quota');
    expect(await canTakeNegotiationTurn('u1', 31)).toBe(false);
  });

  it('Pro user unlimited (past the cap still allowed)', async () => {
    mockIsPro(true);
    const { canTakeNegotiationTurn } = await import('@/lib/billing/quota');
    expect(await canTakeNegotiationTurn('u1', 500)).toBe(true);
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
