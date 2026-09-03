import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

beforeEach(() => {
  vi.resetModules();
  delete process.env.APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

function mockSupabaseServer(opts: {
  error?: { message: string } | null;
  user?: { id: string; email: string } | null;
}) {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({
    data: { user: opts.user ?? null },
    error: opts.error ?? null,
  });
  vi.doMock('@/lib/db/supabase-server', () => ({
    supabaseServer: () => ({ auth: { exchangeCodeForSession } }),
  }));
  return { exchangeCodeForSession };
}

function mockWelcome() {
  const ensureWelcomeEmailSent = vi.fn().mockResolvedValue(undefined);
  vi.doMock('@/lib/email/welcome', () => ({ ensureWelcomeEmailSent }));
  return { ensureWelcomeEmailSent };
}

describe('GET /auth/callback', () => {
  it('redirects to the canonical APP_URL, never req.url origin (Railway container host bug)', async () => {
    mockSupabaseServer({ user: { id: 'u1', email: 'x@y.com' } });
    mockWelcome();
    const { GET } = await import('@/app/auth/callback/route');
    // Requisição chega com origin interno do container — não deve vazar
    // pro redirect final.
    const req = new NextRequest(
      'http://0.0.0.0:8080/auth/callback?code=abc&next=/chat',
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://progpt.com.br/chat');
  });

  it('rejects an absolute-URL "next" (open-redirect guard)', async () => {
    mockSupabaseServer({ user: { id: 'u1', email: 'x@y.com' } });
    mockWelcome();
    const { GET } = await import('@/app/auth/callback/route');
    const req = new NextRequest(
      'http://0.0.0.0:8080/auth/callback?code=abc&next=https://evil.example.com',
    );
    const res = await GET(req);
    expect(res.headers.get('location')).toBe('https://progpt.com.br/chat');
  });

  it('defaults to /chat when no next is given', async () => {
    mockSupabaseServer({ user: { id: 'u1', email: 'x@y.com' } });
    mockWelcome();
    const { GET } = await import('@/app/auth/callback/route');
    const req = new NextRequest('http://0.0.0.0:8080/auth/callback?code=abc');
    const res = await GET(req);
    expect(res.headers.get('location')).toBe('https://progpt.com.br/chat');
  });

  it('fires the welcome email fire-and-forget on a successful code exchange', async () => {
    mockSupabaseServer({ user: { id: 'u1', email: 'x@y.com' } });
    const { ensureWelcomeEmailSent } = mockWelcome();
    const { GET } = await import('@/app/auth/callback/route');
    const req = new NextRequest('http://0.0.0.0:8080/auth/callback?code=abc');
    await GET(req);
    expect(ensureWelcomeEmailSent).toHaveBeenCalledWith('u1', 'x@y.com');
  });

  it('still redirects when there is no code param', async () => {
    mockSupabaseServer({ user: { id: 'u1', email: 'x@y.com' } });
    const { ensureWelcomeEmailSent } = mockWelcome();
    const { GET } = await import('@/app/auth/callback/route');
    const req = new NextRequest('http://0.0.0.0:8080/auth/callback');
    const res = await GET(req);
    expect(res.headers.get('location')).toBe('https://progpt.com.br/chat');
    expect(ensureWelcomeEmailSent).not.toHaveBeenCalled();
  });

  it('does not send welcome email when code exchange fails', async () => {
    mockSupabaseServer({ error: { message: 'invalid code' } });
    const { ensureWelcomeEmailSent } = mockWelcome();
    const { GET } = await import('@/app/auth/callback/route');
    const req = new NextRequest('http://0.0.0.0:8080/auth/callback?code=bad');
    await GET(req);
    expect(ensureWelcomeEmailSent).not.toHaveBeenCalled();
  });
});
