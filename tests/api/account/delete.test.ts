import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(authed: boolean, userId = 'user-1') {
  vi.doMock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>();
    return {
      ...actual,
      requireUser: vi.fn().mockImplementation(async () => {
        if (!authed) throw new (actual.NotAuthenticated)();
        return { id: userId, email: 'me@x.com' };
      }),
    };
  });
}

function mockDeleteAndSignOut(
  deleteError: unknown = null,
  deleteSpy?: ReturnType<typeof vi.fn>,
) {
  const spy = deleteSpy ?? vi.fn().mockResolvedValue({ error: deleteError });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({ auth: { admin: { deleteUser: spy } } }),
  }));
  vi.doMock('@/lib/db/supabase-server', () => ({
    supabaseServer: () => ({
      auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
    }),
  }));
  return spy;
}

describe('POST /api/account/delete', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(false);
    mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'EXCLUIR' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is invalid', async () => {
    mockAuth(true);
    mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: '{not-json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when confirmation phrase does not match', async () => {
    mockAuth(true);
    mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'excluir' }), // lowercase
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('confirmation_mismatch');
  });

  it('calls auth.admin.deleteUser with the authed user id and returns 204', async () => {
    mockAuth(true, 'user-42');
    const spy = mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'EXCLUIR' }),
      }),
    );
    expect(res.status).toBe(204);
    expect(spy).toHaveBeenCalledWith('user-42');
  });

  it('returns 500 when deleteUser errors', async () => {
    mockAuth(true);
    mockDeleteAndSignOut({ message: 'boom' });
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'EXCLUIR' }),
      }),
    );
    expect(res.status).toBe(500);
  });
});
