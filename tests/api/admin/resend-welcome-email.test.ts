import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAdmin(isAdmin: boolean) {
  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error {
      constructor() {
        super('not admin');
        this.name = 'NotAdmin';
      }
    }
    return {
      requireAdmin: vi.fn().mockImplementation(() => {
        if (!isAdmin) throw new NotAdmin();
      }),
      NotAdmin,
    };
  });
}

function mockLookup(opts: { email?: string | null; error?: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.email ? { email: opts.email } : null,
    error: opts.error ?? null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({ from: () => ({ select }) }),
  }));
}

function buildReq(): Request {
  return new Request('http://x/api/admin/users/u1/resend-welcome-email', {
    method: 'POST',
  });
}

describe('POST /api/admin/users/[id]/resend-welcome-email', () => {
  it('returns 404 for non-admin', async () => {
    mockAdmin(false);
    mockLookup({ email: 'x@y.com' });
    vi.doMock('@/lib/email/welcome', () => ({
      resendWelcomeEmail: vi.fn(),
    }));
    const { POST } = await import(
      '@/app/api/admin/users/[id]/resend-welcome-email/route'
    );
    const res = await POST(buildReq(), { params: { id: 'u1' } });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the user is not found', async () => {
    mockAdmin(true);
    mockLookup({ email: null });
    vi.doMock('@/lib/email/welcome', () => ({
      resendWelcomeEmail: vi.fn(),
    }));
    const { POST } = await import(
      '@/app/api/admin/users/[id]/resend-welcome-email/route'
    );
    const res = await POST(buildReq(), { params: { id: 'u1' } });
    expect(res.status).toBe(404);
  });

  it('resends and returns ok:true on success', async () => {
    mockAdmin(true);
    mockLookup({ email: 'kelly@empresa.com' });
    const resendWelcomeEmail = vi.fn().mockResolvedValue({ ok: true });
    vi.doMock('@/lib/email/welcome', () => ({ resendWelcomeEmail }));
    const { POST } = await import(
      '@/app/api/admin/users/[id]/resend-welcome-email/route'
    );
    const res = await POST(buildReq(), { params: { id: 'u1' } });
    expect(res.status).toBe(200);
    expect(resendWelcomeEmail).toHaveBeenCalledWith('u1', 'kelly@empresa.com');
  });

  it('returns 502 when sendEmail fails', async () => {
    mockAdmin(true);
    mockLookup({ email: 'kelly@empresa.com' });
    vi.doMock('@/lib/email/welcome', () => ({
      resendWelcomeEmail: vi.fn().mockResolvedValue({ ok: false }),
    }));
    const { POST } = await import(
      '@/app/api/admin/users/[id]/resend-welcome-email/route'
    );
    const res = await POST(buildReq(), { params: { id: 'u1' } });
    expect(res.status).toBe(502);
  });

  it('includes a From-mismatch hint on 502 when EMAIL_FROM does not match SMTP_USER', async () => {
    const prevHost = process.env.SMTP_HOST;
    const prevUser = process.env.SMTP_USER;
    const prevPassword = process.env.SMTP_PASSWORD;
    const prevFrom = process.env.EMAIL_FROM;
    process.env.SMTP_HOST = 'smtp.titan.email';
    process.env.SMTP_USER = 'comercial@2bsupply.com.br';
    process.env.SMTP_PASSWORD = 'secret';
    process.env.EMAIL_FROM = 'PROGPT <outra-caixa@2bsupply.com.br>';
    try {
      mockAdmin(true);
      mockLookup({ email: 'kelly@empresa.com' });
      vi.doMock('@/lib/email/welcome', () => ({
        resendWelcomeEmail: vi.fn().mockResolvedValue({ ok: false, error: 'blocked' }),
      }));
      const { POST } = await import(
        '@/app/api/admin/users/[id]/resend-welcome-email/route'
      );
      const res = await POST(buildReq(), { params: { id: 'u1' } });
      const body = await res.json();
      expect(res.status).toBe(502);
      expect(body.detail).toBe('blocked');
      expect(body.hint).toMatch(/não bate/);
    } finally {
      if (prevHost === undefined) delete process.env.SMTP_HOST;
      else process.env.SMTP_HOST = prevHost;
      if (prevUser === undefined) delete process.env.SMTP_USER;
      else process.env.SMTP_USER = prevUser;
      if (prevPassword === undefined) delete process.env.SMTP_PASSWORD;
      else process.env.SMTP_PASSWORD = prevPassword;
      if (prevFrom === undefined) delete process.env.EMAIL_FROM;
      else process.env.EMAIL_FROM = prevFrom;
    }
  });
});
