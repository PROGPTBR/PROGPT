import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  process.env.APP_ENV = 'production';
});

function mockCommon(captchaOk: boolean, rateOk: boolean) {
  vi.doMock('@/lib/captcha', () => ({
    verifyTurnstileToken: vi.fn().mockResolvedValue(captchaOk),
    getClientIp: vi.fn().mockReturnValue('5.6.7.8'),
    hashIp: vi.fn().mockReturnValue('hash-x'),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkAnonRateLimit: vi.fn().mockResolvedValue(
      rateOk ? { allowed: true } : { allowed: false, retryAfterSecs: 60 },
    ),
  }));
}

function mockReset(error: unknown) {
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: null, error }),
      },
    }),
  }));
}

describe('POST /api/auth/reset-request', () => {
  it('returns 400 for invalid body', async () => {
    mockCommon(true, true);
    mockReset(null);
    const { POST } = await import('@/app/api/auth/reset-request/route');
    const res = await POST(
      new Request('http://localhost/api/auth/reset-request', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when captcha fails', async () => {
    mockCommon(false, true);
    mockReset(null);
    const { POST } = await import('@/app/api/auth/reset-request/route');
    const res = await POST(
      new Request('http://localhost/api/auth/reset-request', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', captchaToken: 't' }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate-limited', async () => {
    mockCommon(true, false);
    mockReset(null);
    const { POST } = await import('@/app/api/auth/reset-request/route');
    const res = await POST(
      new Request('http://localhost/api/auth/reset-request', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', captchaToken: 't' }),
      }),
    );
    expect(res.status).toBe(429);
  });

  it('returns 200 ok for existing email (anti-enum)', async () => {
    mockCommon(true, true);
    mockReset(null);
    const { POST } = await import('@/app/api/auth/reset-request/route');
    const res = await POST(
      new Request('http://localhost/api/auth/reset-request', {
        method: 'POST',
        body: JSON.stringify({ email: 'exists@b.com', captchaToken: 't' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('returns 200 ok for non-existing email (anti-enum)', async () => {
    mockCommon(true, true);
    // Supabase pode retornar erro pra email inexistente, mas o endpoint
    // ainda retorna 200 (anti-enumeration). Fire-and-forget swallow.
    mockReset({ message: 'User not found' });
    const { POST } = await import('@/app/api/auth/reset-request/route');
    const res = await POST(
      new Request('http://localhost/api/auth/reset-request', {
        method: 'POST',
        body: JSON.stringify({ email: 'nope@b.com', captchaToken: 't' }),
      }),
    );
    expect(res.status).toBe(200);
  });
});
