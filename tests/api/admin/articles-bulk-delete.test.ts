import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(role: 'admin' | 'user') {
  vi.doMock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>();
    return {
      ...actual,
      requireAdmin: vi.fn().mockImplementation(async () => {
        if (role !== 'admin') throw new (actual.NotAdmin)();
        return {
          user: { id: 'admin-1', email: 'a@b.com' } as unknown,
          profile: { id: 'admin-1', role: 'admin', display_name: null },
        };
      }),
    };
  });
}

const VALID_IDS = [
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
];

describe('POST /api/admin/articles/bulk-delete', () => {
  it('non-admin → 404', async () => {
    mockAuth('user');
    const { POST } = await import('@/app/api/admin/articles/bulk-delete/route');
    const req = new Request('http://localhost/api/admin/articles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: VALID_IDS }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('empty ids array → 400', async () => {
    mockAuth('admin');
    vi.doMock('@/lib/db/supabase', () => ({ getServerSupabase: vi.fn() }));
    const { POST } = await import('@/app/api/admin/articles/bulk-delete/route');
    const req = new Request('http://localhost/api/admin/articles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('non-UUID in ids → 400', async () => {
    mockAuth('admin');
    vi.doMock('@/lib/db/supabase', () => ({ getServerSupabase: vi.fn() }));
    const { POST } = await import('@/app/api/admin/articles/bulk-delete/route');
    const req = new Request('http://localhost/api/admin/articles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['not-a-uuid'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('admin + valid ids → 200 with correct deleted count; supabase receives .in(id, ids)', async () => {
    mockAuth('admin');
    const inCalls: Array<{ col: string; vals: string[] }> = [];

    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => {
          const builder: Record<string, unknown> = {};
          builder.delete = vi.fn().mockReturnValue(builder);
          builder.in = vi.fn().mockImplementation((col: string, vals: string[]) => {
            inCalls.push({ col, vals });
            return Promise.resolve({ error: null, count: vals.length });
          });
          return builder;
        },
      }),
    }));

    const { POST } = await import('@/app/api/admin/articles/bulk-delete/route');
    const req = new Request('http://localhost/api/admin/articles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: VALID_IDS }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; deleted: number };
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(VALID_IDS.length);

    // Verify the supabase call used .in('id', VALID_IDS)
    expect(inCalls).toHaveLength(1);
    const firstCall = inCalls[0]!;
    expect(firstCall.col).toBe('id');
    expect(firstCall.vals).toEqual(VALID_IDS);
  });

  it('supabase error → 500', async () => {
    mockAuth('admin');

    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => {
          const builder: Record<string, unknown> = {};
          builder.delete = vi.fn().mockReturnValue(builder);
          builder.in = vi.fn().mockResolvedValue({ error: { message: 'db error' }, count: null });
          return builder;
        },
      }),
    }));

    const { POST } = await import('@/app/api/admin/articles/bulk-delete/route');
    const req = new Request('http://localhost/api/admin/articles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: VALID_IDS }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
