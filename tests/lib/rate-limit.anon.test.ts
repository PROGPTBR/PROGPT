import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockGetServerSupabase(rpcImpl: (args: unknown) => unknown) {
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({ rpc: vi.fn().mockImplementation(rpcImpl) }),
  }));
  // checkChatRateLimit ainda usa supabaseServer — mock pra não vazar
  vi.doMock('@/lib/db/supabase-server', () => ({
    supabaseServer: () => ({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }),
  }));
}

describe('checkAnonRateLimit', () => {
  it('returns allowed:true when RPC says allowed', async () => {
    mockGetServerSupabase(() =>
      Promise.resolve({ data: [{ allowed: true, retry_after_secs: 0 }], error: null }),
    );
    const { checkAnonRateLimit } = await import('@/lib/rate-limit');
    const res = await checkAnonRateLimit('signup', 'abc123');
    expect(res).toEqual({ allowed: true });
  });

  it('returns allowed:false with retryAfterSecs when RPC blocks', async () => {
    mockGetServerSupabase(() =>
      Promise.resolve({ data: [{ allowed: false, retry_after_secs: 60 }], error: null }),
    );
    const { checkAnonRateLimit } = await import('@/lib/rate-limit');
    const res = await checkAnonRateLimit('signup', 'abc123');
    expect(res).toEqual({ allowed: false, retryAfterSecs: 60 });
  });

  it('fails open when RPC errors', async () => {
    mockGetServerSupabase(() => Promise.resolve({ data: null, error: { message: 'boom' } }));
    const { checkAnonRateLimit } = await import('@/lib/rate-limit');
    const res = await checkAnonRateLimit('reset-request', 'xyz');
    expect(res).toEqual({ allowed: true });
  });

  it('passes endpoint + ipHash + limits to RPC', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: [{ allowed: true, retry_after_secs: 0 }],
      error: null,
    });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ rpc: rpcSpy }),
    }));
    vi.doMock('@/lib/db/supabase-server', () => ({
      supabaseServer: () => ({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    }));
    const { checkAnonRateLimit } = await import('@/lib/rate-limit');
    await checkAnonRateLimit('signup', 'hash1', 5, 20);
    expect(rpcSpy).toHaveBeenCalledWith('check_rate_limit_anon', {
      p_ip_hash: 'hash1',
      p_endpoint: 'signup',
      p_per_min: 5,
      p_per_hour: 20,
    });
  });
});
