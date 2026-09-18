import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockDeps(opts: { allowed?: boolean; accept?: unknown }) {
  vi.doMock('@/lib/rate-limit', () => ({
    checkAnonRateLimit: vi.fn().mockResolvedValue({ allowed: opts.allowed ?? true }),
  }));
  vi.doMock('@/lib/captcha', () => ({
    getClientIp: () => '1.2.3.4',
    hashIp: () => 'hash',
  }));
  const acceptInvite = vi.fn().mockResolvedValue(
    opts.accept ?? { ok: true, email: 'colega@x.com', created: true },
  );
  vi.doMock('@/lib/billing/seat-members', () => ({ acceptInvite }));
  return { acceptInvite };
}

function req(body: unknown) {
  return new Request('http://x/api/convite/tok/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/convite/[token]/accept', () => {
  it('rate-limits guessing attempts by IP', async () => {
    mockDeps({ allowed: false });
    const { POST } = await import('@/app/api/convite/[token]/accept/route');
    const res = await POST(req({ password: 'senha12345' }), { params: { token: 'tok' } });
    expect(res.status).toBe(429);
  });

  it('accepts a valid invite and reports that the account was created', async () => {
    mockDeps({});
    const { POST } = await import('@/app/api/convite/[token]/accept/route');
    const res = await POST(req({ password: 'senha12345', fullName: 'Maria' }),
      { params: { token: 'tok' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, created: true });
  });

  it('gives an actionable message for a dead token', async () => {
    mockDeps({ accept: { ok: false, reason: 'invalid_token' } });
    const { POST } = await import('@/app/api/convite/[token]/accept/route');
    const res = await POST(req({ password: 'senha12345' }), { params: { token: 'x' } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/não é mais válido/i);
  });
});
