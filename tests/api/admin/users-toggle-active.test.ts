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
  vi.doMock('@/lib/observability/audit-log', () => ({ recordAuditLog: vi.fn() }));
}

function buildReq(body: unknown): Request {
  return new Request('http://x/api/admin/users/u2/toggle-active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/users/[id]/toggle-active', () => {
  it('returns 404 for non-admin', async () => {
    mockAuth('user');
    const { POST } = await import('@/app/api/admin/users/[id]/toggle-active/route');
    const res = await POST(buildReq({ active: false }), { params: { id: 'u2' } });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid body', async () => {
    mockAuth('admin');
    const { POST } = await import('@/app/api/admin/users/[id]/toggle-active/route');
    const res = await POST(buildReq({}), { params: { id: 'u2' } });
    expect(res.status).toBe(400);
  });

  it('refuses self-deactivation', async () => {
    mockAuth('admin', 'admin-1');
    const { POST } = await import('@/app/api/admin/users/[id]/toggle-active/route');
    const res = await POST(buildReq({ active: false }), { params: { id: 'admin-1' } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('cannot_deactivate_self');
  });

  it('deactivates by setting a long ban_duration', async () => {
    mockAuth('admin');
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ auth: { admin: { updateUserById } } }),
    }));
    const { POST } = await import('@/app/api/admin/users/[id]/toggle-active/route');
    const res = await POST(buildReq({ active: false }), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith('u2', { ban_duration: '876000h' });
  });

  it('reactivates with ban_duration "none"', async () => {
    mockAuth('admin');
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ auth: { admin: { updateUserById } } }),
    }));
    const { POST } = await import('@/app/api/admin/users/[id]/toggle-active/route');
    const res = await POST(buildReq({ active: true }), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith('u2', { ban_duration: 'none' });
  });

  it('returns 500 when supabase errors', async () => {
    mockAuth('admin');
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ error: { message: 'boom' } }) } },
      }),
    }));
    const { POST } = await import('@/app/api/admin/users/[id]/toggle-active/route');
    const res = await POST(buildReq({ active: false }), { params: { id: 'u2' } });
    expect(res.status).toBe(500);
  });
});
