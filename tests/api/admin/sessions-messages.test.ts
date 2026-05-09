import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => { vi.resetModules(); });

function setupMocks(opts: { isAdmin: boolean; messages?: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { messages: opts.messages ?? [] }, error: null });
  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error { constructor() { super('not admin'); this.name = 'NotAdmin'; } }
    return {
      requireAdmin: vi.fn().mockImplementation(() => { if (!opts.isAdmin) throw new NotAdmin(); }),
      NotAdmin,
    };
  });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    }),
  }));
}

describe('GET /api/admin/sessions/[id]/messages', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { GET } = await import('@/app/api/admin/sessions/[id]/messages/route');
    const res = await GET(new Request('http://x'), { params: { id: 's1' } });
    expect(res.status).toBe(404);
  });

  it('returns messages for admin', async () => {
    setupMocks({ isAdmin: true, messages: [{ role: 'user', content: 'q' }] });
    const { GET } = await import('@/app/api/admin/sessions/[id]/messages/route');
    const res = await GET(new Request('http://x'), { params: { id: 's1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(1);
  });
});
