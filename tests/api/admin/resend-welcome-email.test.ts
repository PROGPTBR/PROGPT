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
});
