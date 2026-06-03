import { describe, expect, it, vi, beforeEach } from 'vitest';
import { computeCostUsdCents } from '@/lib/observability/api-usage';

beforeEach(() => {
  vi.resetModules();
});

describe('computeCostUsdCents', () => {
  it('OpenAI Whisper: bills per minute of audio (tokensIn = seconds)', () => {
    // 60 seconds of audio = 1 minute = $0.006 = 0.6 cents
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'chat-transcribe',
      tokensIn: 60,
    });
    expect(cost).toBeCloseTo(0.6, 4);
  });

  it('OpenAI Whisper: 10s clip costs $0.001 = 0.1 cents', () => {
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'chat-transcribe',
      tokensIn: 10,
    });
    expect(cost).toBeCloseTo(0.1, 4);
  });

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

// ── per-model rate cards (model tiering caveat #1) ───────────────────────────
// computeCostUsdCents used to be hardcoded to gpt-4o-mini rates and ignored the
// model string — so a tier flipped to gpt-4o would silently UNDER-count on
// /admin/costs. Now the rate is resolved per model (prefix-aware), unknown
// non-empty models fall back to the most expensive known rate (over- not
// under-count), and an empty/missing model keeps the historical mini default.
describe('computeCostUsdCents — per-model OpenAI rate cards', () => {
  it('gpt-4o billed at 4o rates (~16x mini)', () => {
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'chat-generate',
      model: 'gpt-4o',
      tokensIn: 1_000_000,
      tokensOut: 1_000_000,
    });
    // 1M*$2.50 + 1M*$10 = $12.50 = 1250 cents
    expect(cost).toBeCloseTo(1250, 4);
  });

  it('gpt-4o cached input billed at half rate', () => {
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'chat-generate',
      model: 'gpt-4o',
      tokensIn: 1_000_000,
      tokensCached: 1_000_000,
    });
    // all 1M input cached → 1M*$1.25 = $1.25 = 125 cents
    expect(cost).toBeCloseTo(125, 4);
  });

  it('versioned gpt-4o-mini-* string matches mini by prefix (not 4o)', () => {
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'classify',
      model: 'gpt-4o-mini-2024-07-18',
      tokensIn: 1_000_000,
    });
    expect(cost).toBeCloseTo(15, 4); // 1M*$0.15 = 15 cents (mini)
  });

  it('versioned gpt-4o-* string matches 4o by prefix', () => {
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'chat-generate',
      model: 'gpt-4o-2024-11-20',
      tokensIn: 1_000_000,
    });
    expect(cost).toBeCloseTo(250, 4); // 1M*$2.50
  });

  it('gpt-5.4-mini billed at 5.4-mini rates', () => {
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'chat-generate',
      model: 'gpt-5.4-mini',
      tokensIn: 1_000_000,
      tokensOut: 1_000_000,
    });
    // 1M*$0.75 + 1M*$4.50 = $5.25 = 525 cents
    expect(cost).toBeCloseTo(525, 4);
  });

  it('versioned gpt-5.4-mini-* matches mini by prefix (not full gpt-5.4)', () => {
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'chat-generate',
      model: 'gpt-5.4-mini-2026-03-17',
      tokensIn: 1_000_000,
    });
    expect(cost).toBeCloseTo(75, 4); // 1M*$0.75 (mini), not the $2.50 full rate
  });

  it('gpt-5.4 (full) billed above its mini', () => {
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'chat-generate',
      model: 'gpt-5.4',
      tokensIn: 1_000_000,
    });
    expect(cost).toBeCloseTo(250, 4); // 1M*$2.50
  });

  it('unknown non-empty model falls back to the most expensive known rate (never under-counts)', () => {
    const unknown = computeCostUsdCents({
      provider: 'openai',
      operation: 'chat-generate',
      model: 'some-future-model-x',
      tokensIn: 1_000_000,
    });
    // most expensive known is gpt-5.5: $5/1M input = 500 cents
    expect(unknown).toBeCloseTo(500, 4);
    expect(unknown).toBeGreaterThan(250); // strictly above gpt-4o
  });

  it('missing/empty model keeps the historical mini default (back-compat)', () => {
    const cost = computeCostUsdCents({
      provider: 'openai',
      operation: 'chat-generate',
      tokensIn: 1_000_000,
    });
    expect(cost).toBeCloseTo(15, 4); // mini
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
