import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  process.env.APP_ENV = 'production';
});

function mockCommon(captchaOk: boolean, rateOk: boolean) {
  vi.doMock('@/lib/captcha', () => ({
    verifyTurnstileToken: vi.fn().mockResolvedValue(captchaOk),
    getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
    hashIp: vi.fn().mockReturnValue('hash-abc'),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkAnonRateLimit: vi.fn().mockResolvedValue(
      rateOk ? { allowed: true } : { allowed: false, retryAfterSecs: 60 },
    ),
  }));
}

function mockSignUp(result: { data: unknown; error: unknown }) {
  // Mock: auth.signUp + from('profiles').update().eq() chain pra
  // persistência do terms_accepted_at (sub-projeto 28).
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      auth: { signUp: vi.fn().mockResolvedValue(result) },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ eq: updateEq }),
      }),
    }),
  }));
  return { updateEq };
}

const VALID_BODY = {
  email: 'a@b.com',
  password: 'longenoughpw',
  captchaToken: 't',
  acceptedTerms: true,
};

describe('POST /api/auth/signup', () => {
  it('returns 400 for invalid body (missing acceptedTerms)', async () => {
    mockCommon(true, true);
    mockSignUp({ data: { session: null, user: { id: 'u1' } }, error: null });
    const { POST } = await import('@/app/api/auth/signup/route');
    const res = await POST(
      new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: 'a@b.com',
          password: 'longenoughpw',
          captchaToken: 't',
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when acceptedTerms is false', async () => {
    mockCommon(true, true);
    mockSignUp({ data: { session: null, user: { id: 'u1' } }, error: null });
    const { POST } = await import('@/app/api/auth/signup/route');
    const res = await POST(
      new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ ...VALID_BODY, acceptedTerms: false }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 captcha_invalid when verify fails', async () => {
    mockCommon(false, true);
    mockSignUp({ data: { session: null, user: { id: 'u1' } }, error: null });
    const { POST } = await import('@/app/api/auth/signup/route');
    const res = await POST(
      new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(VALID_BODY),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('captcha_invalid');
  });

  it('returns 429 when rate-limited', async () => {
    mockCommon(true, false);
    mockSignUp({ data: { session: null, user: { id: 'u1' } }, error: null });
    const { POST } = await import('@/app/api/auth/signup/route');
    const res = await POST(
      new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(VALID_BODY),
      }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('returns 200 + persists terms_accepted_at on success', async () => {
    mockCommon(true, true);
    const { updateEq } = mockSignUp({
      data: { session: null, user: { id: 'new-user-1' } },
      error: null,
    });
    const { POST } = await import('@/app/api/auth/signup/route');
    const res = await POST(
      new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(VALID_BODY),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, checkEmail: true });
    // O update do profile é fire-and-forget — espera o microtask resolver.
    await new Promise((r) => setTimeout(r, 5));
    expect(updateEq).toHaveBeenCalledWith('id', 'new-user-1');
  });

  it('returns 409 user_already_exists', async () => {
    mockCommon(true, true);
    mockSignUp({
      data: { session: null, user: null },
      error: { message: 'User already registered', code: 'user_already_exists' },
    });
    const { POST } = await import('@/app/api/auth/signup/route');
    const res = await POST(
      new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(VALID_BODY),
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('user_already_exists');
  });
});
