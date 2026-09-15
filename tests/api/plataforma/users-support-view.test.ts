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

describe('GET /api/plataforma/users/[id]/sessions', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { GET } = await import('@/app/api/plataforma/users/[id]/sessions/route');
    const res = await GET(new Request('http://x'), { params: { id: 'u2' } });
    expect(res.status).toBe(404);
  });

  it('lists sessions filtered by user_id, newest first', async () => {
    mockAuth(true);
    const order = vi.fn().mockReturnValue({
      limit: () =>
        Promise.resolve({
          data: [{ id: 's1', title: 'Kraljic', updated_at: '2026-09-15T00:00:00Z' }],
          error: null,
        }),
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ select }) }),
    }));
    const { GET } = await import('@/app/api/plataforma/users/[id]/sessions/route');
    const res = await GET(new Request('http://x'), { params: { id: 'u2' } });
    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith('user_id', 'u2');
    const body = (await res.json()) as { sessions: Array<{ id: string }> };
    expect(body.sessions[0]!.id).toBe('s1');
  });
});

describe('GET /api/plataforma/users/[id]/sessions/[sessionId]', () => {
  it('returns 404 for non-super-admin', async () => {
    mockAuth(false);
    const { GET } = await import('@/app/api/plataforma/users/[id]/sessions/[sessionId]/route');
    const res = await GET(new Request('http://x'), { params: { id: 'u2', sessionId: 's1' } });
    expect(res.status).toBe(404);
  });

  it('refuses a session that belongs to a different user (ownership check)', async () => {
    mockAuth(true);
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { user_id: 'someone-else', title: 'x', messages: [] },
      error: null,
    });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
    }));
    const { GET } = await import('@/app/api/plataforma/users/[id]/sessions/[sessionId]/route');
    const res = await GET(new Request('http://x'), { params: { id: 'u2', sessionId: 's1' } });
    expect(res.status).toBe(404);
  });

  it('returns the messages and logs a support_view audit entry', async () => {
    mockAuth(true, 'admin-1');
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { user_id: 'u2', title: 'Kraljic', messages: [{ role: 'user', content: 'oi' }] },
      error: null,
    });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
    }));
    const { recordAuditLog } = await import('@/lib/observability/audit-log');
    const { GET } = await import('@/app/api/plataforma/users/[id]/sessions/[sessionId]/route');
    const res = await GET(new Request('http://x'), { params: { id: 'u2', sessionId: 's1' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { messages: Array<{ role: string }> };
    expect(body.messages).toHaveLength(1);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'user.support_view',
        resourceType: 'session',
        resourceId: 's1',
        metadata: { targetUserId: 'u2' },
      }),
    );
  });
});
