import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOpenAIModel, withRateLimitRetry } from '@/lib/llm/openai';

function rateLimitErr(retrySecs = 1.5) {
  const e = new Error(
    `Rate limit reached for gpt-4o-mini in organization org-X. Limit 200000, Used 200000. Please try again in ${retrySecs}s.`,
  ) as Error & { status: number; code: string };
  e.status = 429;
  e.code = 'rate_limit_exceeded';
  return e;
}

describe('withRateLimitRetry', () => {
  it('returns the result on first-call success without retrying', async () => {
    const call = vi.fn().mockResolvedValue('ok');
    const out = await withRateLimitRetry(call, new AbortController().signal, 'test');
    expect(out).toBe('ok');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-429 errors immediately without retry', async () => {
    const err = new Error('ECONNRESET');
    const call = vi.fn().mockRejectedValueOnce(err);
    await expect(
      withRateLimitRetry(call, new AbortController().signal, 'test'),
    ).rejects.toThrow(/ECONNRESET/);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries once on 429 honoring the "try again in Xs" hint, then succeeds', async () => {
    vi.useFakeTimers();
    try {
      const call = vi
        .fn()
        .mockRejectedValueOnce(rateLimitErr(0.5))
        .mockResolvedValueOnce('after-retry');
      const promise = withRateLimitRetry(
        call,
        new AbortController().signal,
        'test',
      );
      // Advance past the wait (0.5s + 0.5s safety margin = 1000ms)
      await vi.advanceTimersByTimeAsync(1100);
      expect(await promise).toBe('after-retry');
      expect(call).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rethrows the second 429 instead of stacking more retries', async () => {
    vi.useFakeTimers();
    try {
      const call = vi
        .fn()
        .mockRejectedValueOnce(rateLimitErr(0.1))
        .mockRejectedValueOnce(rateLimitErr(0.1));
      const promise = withRateLimitRetry(
        call,
        new AbortController().signal,
        'test',
      );
      const expectation = expect(promise).rejects.toThrow(/Rate limit/);
      await vi.advanceTimersByTimeAsync(1000);
      await expectation;
      expect(call).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts the retry when the signal fires during the wait', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const call = vi.fn().mockRejectedValue(rateLimitErr(2));
      const promise = withRateLimitRetry(call, controller.signal, 'test');
      const expectation = expect(promise).rejects.toThrow();
      controller.abort();
      await vi.advanceTimersByTimeAsync(2500);
      await expectation;
      // Only the first attempt happened — the post-wait branch saw the signal aborted
      expect(call).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── model tiering ──────────────────────────────────────────────────────────
// getOpenAIModel(tier) reads a per-tier env with a chained fallback
// (OPENAI_MODEL_<TIER> -> OPENAI_MODEL -> gpt-4o-mini) so a single global flip
// no longer hits all ~30 call-sites. Default tier is the CHEAP 'routing' so a
// non-annotated call-site can never inherit the expensive model by accident.

const TIER_KEYS = [
  'OPENAI_MODEL',
  'OPENAI_MODEL_GENERATION',
  'OPENAI_MODEL_ROUTING',
  'OPENAI_MODEL_MULTIMODAL',
] as const;

describe('getOpenAIModel tiering', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of TIER_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of TIER_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('defaults every tier to gpt-4o-mini when no env is set', () => {
    expect(getOpenAIModel()).toBe('gpt-4o-mini');
    expect(getOpenAIModel('generation')).toBe('gpt-4o-mini');
    expect(getOpenAIModel('routing')).toBe('gpt-4o-mini');
    expect(getOpenAIModel('multimodal')).toBe('gpt-4o-mini');
  });

  it('no-arg call resolves to the cheap routing tier (never the expensive model by accident)', () => {
    process.env.OPENAI_MODEL_GENERATION = 'gpt-4o';
    // a non-annotated site (no arg) must NOT pick up the generation override
    expect(getOpenAIModel()).toBe('gpt-4o-mini');
    expect(getOpenAIModel('generation')).toBe('gpt-4o');
  });

  it('falls back to OPENAI_MODEL for every tier when no tier env is set (back-compat)', () => {
    process.env.OPENAI_MODEL = 'gpt-4.1';
    expect(getOpenAIModel('generation')).toBe('gpt-4.1');
    expect(getOpenAIModel('routing')).toBe('gpt-4.1');
    expect(getOpenAIModel('multimodal')).toBe('gpt-4.1');
  });

  it('tier-specific env overrides OPENAI_MODEL only for that tier', () => {
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
    process.env.OPENAI_MODEL_MULTIMODAL = 'gpt-4o';
    expect(getOpenAIModel('multimodal')).toBe('gpt-4o');
    expect(getOpenAIModel('generation')).toBe('gpt-4o-mini');
    expect(getOpenAIModel('routing')).toBe('gpt-4o-mini');
  });

  it('treats an empty-string env as unset (falls through the chain)', () => {
    process.env.OPENAI_MODEL_GENERATION = '';
    process.env.OPENAI_MODEL = 'gpt-4.1';
    expect(getOpenAIModel('generation')).toBe('gpt-4.1');
  });
});
