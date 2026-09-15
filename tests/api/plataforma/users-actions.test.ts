import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(isSuperAdmin: boolean, userId = 'admin-1') {
  vi.doMock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>();
    return {
      ...actual,
      requireSuperAdmin: vi.fn().mockImplementation(async () => {
        if (!isSuperAdmin) throw new (actual.NotSuperAdmin)();
        return {
          user: { id: userId, email: 'a@b.com' } as unknown,
          profile: { id: userId, role: 'user', display_name: null, super_admin: true },
        };
      }),
    };
  });
  vi.doMock('@/lib/observability/audit-log', () => ({ recordAuditLog: vi.fn() }));
}

function buildReq(url: string, body?: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/plataforma/users/[id]/toggle-active', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { POST } = await import('@/app/api/plataforma/users/[id]/toggle-active/route');
    const res = await POST(buildReq('http://x', { active: false }), { params: { id: 'u2' } });
    expect(res.status).toBe(404);
  });

  it('refuses self-deactivation', async () => {
    mockAuth(true, 'admin-1');
    const { POST } = await import('@/app/api/plataforma/users/[id]/toggle-active/route');
    const res = await POST(buildReq('http://x', { active: false }), { params: { id: 'admin-1' } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('cannot_deactivate_self');
  });

  it('deactivates via a long ban_duration', async () => {
    mockAuth(true);
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ auth: { admin: { updateUserById } } }),
    }));
    const { POST } = await import('@/app/api/plataforma/users/[id]/toggle-active/route');
    const res = await POST(buildReq('http://x', { active: false }), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith('u2', { ban_duration: '876000h' });
  });

  it('reactivates with ban_duration none', async () => {
    mockAuth(true);
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ auth: { admin: { updateUserById } } }),
    }));
    const { POST } = await import('@/app/api/plataforma/users/[id]/toggle-active/route');
    const res = await POST(buildReq('http://x', { active: true }), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith('u2', { ban_duration: 'none' });
  });
});

describe('POST /api/plataforma/users/[id]/reset-password', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    vi.doMock('@/lib/db/supabase', () => ({ getServerSupabase: () => ({}) }));
    const { POST } = await import('@/app/api/plataforma/users/[id]/reset-password/route');
    const res = await POST(buildReq('http://x'), { params: { id: 'u2' } });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the user is not found', async () => {
    mockAuth(true);
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
    }));
    const { POST } = await import('@/app/api/plataforma/users/[id]/reset-password/route');
    const res = await POST(buildReq('http://x'), { params: { id: 'u2' } });
    expect(res.status).toBe(404);
  });

  it('sends the reset email for the resolved address', async () => {
    mockAuth(true);
    const maybeSingle = vi.fn().mockResolvedValue({ data: { email: 'kelly@empresa.com' }, error: null });
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
        auth: { resetPasswordForEmail },
      }),
    }));
    const { POST } = await import('@/app/api/plataforma/users/[id]/reset-password/route');
    const res = await POST(buildReq('http://x'), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      'kelly@empresa.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') }),
    );
  });
});

describe('POST /api/plataforma/users/[id]/billing', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { POST } = await import('@/app/api/plataforma/users/[id]/billing/route');
    const res = await POST(buildReq('http://x', { action: 'release' }), { params: { id: 'u2' } });
    expect(res.status).toBe(404);
  });

  it('releases access by upserting status=active', async () => {
    mockAuth(true);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ upsert }) }),
    }));
    const { POST } = await import('@/app/api/plataforma/users/[id]/billing/route');
    const res = await POST(buildReq('http://x', { action: 'release' }), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u2', status: 'active', plan: 'pro' }),
      { onConflict: 'user_id' },
    );
  });

  it('blocks access by upserting status=expired', async () => {
    mockAuth(true);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ upsert }) }),
    }));
    const { POST } = await import('@/app/api/plataforma/users/[id]/billing/route');
    const res = await POST(buildReq('http://x', { action: 'block' }), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired' }),
      { onConflict: 'user_id' },
    );
  });
});
