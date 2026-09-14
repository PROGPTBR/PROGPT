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
        return { user: { id: 'admin-1', email: 'a@b.com' }, profile: { id: 'admin-1', role: 'admin' } };
      }),
      NotAdmin,
    };
  });
  vi.doMock('@/lib/observability/audit-log', () => ({ recordAuditLog: vi.fn() }));
}

function mockLookupAndReset(opts: {
  email?: string | null;
  lookupError?: { message: string } | null;
  resetError?: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.email ? { email: opts.email } : null,
    error: opts.lookupError ?? null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: opts.resetError ?? null });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({ select }),
      auth: { resetPasswordForEmail },
    }),
  }));
  return { resetPasswordForEmail };
}

function buildReq(): Request {
  return new Request('http://x/api/admin/users/u1/reset-password', { method: 'POST' });
}

describe('POST /api/admin/users/[id]/reset-password', () => {
  it('returns 404 for non-admin', async () => {
    mockAdmin(false);
    mockLookupAndReset({ email: 'x@y.com' });
    const { POST } = await import('@/app/api/admin/users/[id]/reset-password/route');
    const res = await POST(buildReq(), { params: { id: 'u1' } });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the user is not found', async () => {
    mockAdmin(true);
    mockLookupAndReset({ email: null });
    const { POST } = await import('@/app/api/admin/users/[id]/reset-password/route');
    const res = await POST(buildReq(), { params: { id: 'u1' } });
    expect(res.status).toBe(404);
  });

  it('sends the reset email with a redirectTo pointing at /reset-password', async () => {
    mockAdmin(true);
    const { resetPasswordForEmail } = mockLookupAndReset({ email: 'kelly@empresa.com' });
    const { POST } = await import('@/app/api/admin/users/[id]/reset-password/route');
    const res = await POST(buildReq(), { params: { id: 'u1' } });
    expect(res.status).toBe(200);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      'kelly@empresa.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') }),
    );
  });

  it('returns 502 when supabase fails to send the email', async () => {
    mockAdmin(true);
    mockLookupAndReset({ email: 'kelly@empresa.com', resetError: { message: 'smtp down' } });
    const { POST } = await import('@/app/api/admin/users/[id]/reset-password/route');
    const res = await POST(buildReq(), { params: { id: 'u1' } });
    expect(res.status).toBe(502);
  });
});
