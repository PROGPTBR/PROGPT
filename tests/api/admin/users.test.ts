import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(role: 'admin' | 'user', userId: string = 'admin-1') {
  vi.doMock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>();
    return {
      ...actual,
      requireAdmin: vi.fn().mockImplementation(async () => {
        if (role !== 'admin') throw new (actual.NotAdmin)();
        return {
          user: { id: userId, email: 'a@b.com' } as unknown,
          profile: { id: userId, role: 'admin', display_name: null },
        };
      }),
    };
  });
}

describe('POST/PATCH /api/admin/users', () => {
  it('non-admin gets 404 (does not reveal existence)', async () => {
    mockAuth('user');
    const { POST } = await import('@/app/api/admin/users/route');
    const res = await POST(
      new Request('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: 'x@y.com' }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it('admin invite calls supabase.auth.admin.inviteUserByEmail with redirect', async () => {
    mockAuth('admin');
    const inviteSpy = vi.fn().mockResolvedValue({ data: { user: { id: 'new' } }, error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        auth: { admin: { inviteUserByEmail: inviteSpy } },
      }),
    }));
    const { POST } = await import('@/app/api/admin/users/route');
    const res = await POST(
      new Request('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: 'novo@empresa.com' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(inviteSpy).toHaveBeenCalledWith(
      'novo@empresa.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/auth/callback?next=/reset-password') }),
    );
  });

  it('PATCH role updates profiles via cookie-aware client', async () => {
    mockAuth('admin', 'admin-1');
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/db/supabase-server', () => ({
      supabaseServer: () => ({
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({ eq: updateEq }),
        }),
      }),
    }));
    const { PATCH } = await import('@/app/api/admin/users/route');
    const res = await PATCH(
      new Request('http://localhost/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({ user_id: '11111111-1111-1111-1111-111111111111', role: 'admin' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(updateEq).toHaveBeenCalledWith('id', '11111111-1111-1111-1111-111111111111');
  });

  it('PATCH self-demote returns 400', async () => {
    mockAuth('admin', '22222222-2222-2222-2222-222222222222');
    const { PATCH } = await import('@/app/api/admin/users/route');
    const res = await PATCH(
      new Request('http://localhost/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({ user_id: '22222222-2222-2222-2222-222222222222', role: 'user' }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('cannot_self_demote');
  });
});
