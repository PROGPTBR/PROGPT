import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  delete process.env.APP_ENV;
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.APP_SECRET;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('verifyTurnstileToken', () => {
  it('returns true in local env without calling Cloudflare', async () => {
    process.env.APP_ENV = 'local';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { verifyTurnstileToken } = await import('@/lib/captcha');
    expect(await verifyTurnstileToken('whatever')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns true in ci env without calling Cloudflare', async () => {
    process.env.APP_ENV = 'ci';
    const { verifyTurnstileToken } = await import('@/lib/captcha');
    expect(await verifyTurnstileToken(null)).toBe(true);
  });

  it('returns false in production without token', async () => {
    process.env.APP_ENV = 'production';
    process.env.TURNSTILE_SECRET_KEY = 'real-secret';
    const { verifyTurnstileToken } = await import('@/lib/captcha');
    expect(await verifyTurnstileToken('')).toBe(false);
    expect(await verifyTurnstileToken(null)).toBe(false);
  });

  it('calls Cloudflare and returns success in production', async () => {
    process.env.APP_ENV = 'production';
    process.env.TURNSTILE_SECRET_KEY = 'real-secret';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    const { verifyTurnstileToken } = await import('@/lib/captcha');
    expect(await verifyTurnstileToken('valid-token', '1.2.3.4')).toBe(true);
  });

  it('returns false when Cloudflare says success=false', async () => {
    process.env.APP_ENV = 'production';
    process.env.TURNSTILE_SECRET_KEY = 'real-secret';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    );
    const { verifyTurnstileToken } = await import('@/lib/captcha');
    expect(await verifyTurnstileToken('bad-token')).toBe(false);
  });

  it('returns false when Cloudflare returns 5xx', async () => {
    process.env.APP_ENV = 'production';
    process.env.TURNSTILE_SECRET_KEY = 'real-secret';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    const { verifyTurnstileToken } = await import('@/lib/captcha');
    expect(await verifyTurnstileToken('token')).toBe(false);
  });

  it('returns false when fetch throws', async () => {
    process.env.APP_ENV = 'production';
    process.env.TURNSTILE_SECRET_KEY = 'real-secret';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));
    const { verifyTurnstileToken } = await import('@/lib/captcha');
    expect(await verifyTurnstileToken('token')).toBe(false);
  });
});

describe('getClientIp', () => {
  it('reads first IP from x-forwarded-for', async () => {
    const { getClientIp } = await import('@/lib/captcha');
    const req = new Request('http://x', {
      headers: { 'x-forwarded-for': '203.0.113.45, 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('203.0.113.45');
  });

  it('falls back to x-real-ip', async () => {
    const { getClientIp } = await import('@/lib/captcha');
    const req = new Request('http://x', {
      headers: { 'x-real-ip': '198.51.100.7' },
    });
    expect(getClientIp(req)).toBe('198.51.100.7');
  });

  it('returns null when neither header is present', async () => {
    const { getClientIp } = await import('@/lib/captcha');
    const req = new Request('http://x');
    expect(getClientIp(req)).toBeNull();
  });
});

describe('hashIp', () => {
  it('returns 32-char hex hash', async () => {
    process.env.APP_SECRET = 'test-salt';
    const { hashIp } = await import('@/lib/captcha');
    const h = hashIp('1.2.3.4');
    expect(h).toMatch(/^[a-f0-9]{32}$/);
  });

  it('same ip+salt always produces same hash (deterministic)', async () => {
    process.env.APP_SECRET = 'test-salt';
    const { hashIp } = await import('@/lib/captcha');
    expect(hashIp('5.6.7.8')).toBe(hashIp('5.6.7.8'));
  });

  it('different salts produce different hashes for same IP', async () => {
    const { hashIp } = await import('@/lib/captcha');
    process.env.APP_SECRET = 'salt-a';
    const h1 = hashIp('9.9.9.9');
    vi.resetModules();
    process.env.APP_SECRET = 'salt-b';
    const { hashIp: hashIp2 } = await import('@/lib/captcha');
    const h2 = hashIp2('9.9.9.9');
    expect(h1).not.toBe(h2);
  });

  it('returns empty string for null IP', async () => {
    const { hashIp } = await import('@/lib/captcha');
    expect(hashIp(null)).toBe('');
  });
});
