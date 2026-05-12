import { describe, expect, it, vi, beforeEach } from 'vitest';
import { computeCostUsdCents } from '@/lib/observability/api-usage';

beforeEach(() => {
  vi.resetModules();
});

describe('computeCostUsdCents', () => {
  it('OpenAI: uncached input at full rate, cached input at half rate, output at output rate', () => {
    // 1M uncached input + 1M cached input + 1M output
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'chat-generate',
      tokensIn: 2_000_000,
      tokensCached: 1_000_000,
      tokensOut: 1_000_000,
    });
    // expected: (1M / 1M)*$0.15 + (1M / 1M)*$0.075 + (1M / 1M)*$0.60 = $0.825
    // in cents = 82.5
    expect(cost).toBeCloseTo(82.5, 4);
  });

  it('OpenAI: no cached → all input at full rate', () => {
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'classify',
      tokensIn: 1_000_000,
      tokensOut: 500_000,
    });
    // 1M*$0.15 + 0.5M*$0.60 = $0.45 = 45 cents
    expect(cost).toBeCloseTo(45, 4);
  });

  it('OpenAI: small classify call (~600 in, ~80 out) costs fractional cents', () => {
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'classify',
      tokensIn: 600,
      tokensOut: 80,
    });
    // 600*$0.15/1M + 80*$0.60/1M = $0.00009 + $0.000048 = $0.000138 ≈ 0.0138 cents
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.1);
  });

  it('Voyage: tokens × per-M rate', () => {
    const cost = computeCostUsdCents({
      provider: 'voyage',
      operation: 'embed',
      tokensIn: 1_000_000,
    });
    // 1M tokens * $0.18/1M = $0.18 = 18 cents
    expect(cost).toBeCloseTo(18, 4);
  });

  it('Cohere: per-call rate (always 1 call regardless of doc count)', () => {
    const cost = computeCostUsdCents({
      provider: 'cohere',
      operation: 'rerank',
      callCount: 1,
    });
    // $2 / 1000 calls = $0.002 per call = 0.2 cents
    expect(cost).toBeCloseTo(0.2, 4);
  });

  it('Cohere: 1000 calls = $2 = 200 cents', () => {
    const cost = computeCostUsdCents({
      provider: 'cohere',
      operation: 'rerank',
      callCount: 1000,
    });
    expect(cost).toBeCloseTo(200, 4);
  });

  it('returns 0 for zero token / zero call inputs', () => {
    expect(
      computeCostUsdCents({ provider: 'openai', operation: 'chat-generate' }),
    ).toBe(0);
    expect(
      computeCostUsdCents({ provider: 'voyage', operation: 'embed' }),
    ).toBe(0);
    expect(
      computeCostUsdCents({ provider: 'cohere', operation: 'rerank', callCount: 0 }),
    ).toBe(0);
  });
});

describe('recordApiUsage', () => {
  it('inserts a row with computed cost', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ insert }) }),
    }));
    const { recordApiUsage } = await import('@/lib/observability/api-usage');
    await recordApiUsage({
      provider: 'openai',
      operation: 'classify',
      tokensIn: 600,
      tokensOut: 80,
      model: 'gpt-4o-mini',
    });
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0]![0];
    expect(row.provider).toBe('openai');
    expect(row.operation).toBe('classify');
    expect(row.tokens_in).toBe(600);
    expect(row.tokens_out).toBe(80);
    expect(row.cost_usd_cents).toBeGreaterThan(0);
    expect(row.cost_usd_cents).toBeLessThan(1);
  });

  it('swallows errors so cost-tracking failures never break the pipeline', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ insert }) }),
    }));
    const { recordApiUsage } = await import('@/lib/observability/api-usage');
    // Should not throw
    await expect(
      recordApiUsage({ provider: 'openai', operation: 'chat-generate', tokensIn: 1 }),
    ).resolves.toBeUndefined();
  });

  it('swallows throws (network errors etc.) from supabase', async () => {
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => {
        throw new Error('connection refused');
      },
    }));
    const { recordApiUsage } = await import('@/lib/observability/api-usage');
    await expect(
      recordApiUsage({ provider: 'openai', operation: 'chat-generate', tokensIn: 1 }),
    ).resolves.toBeUndefined();
  });
});
