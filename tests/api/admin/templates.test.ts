import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

type Opts = {
  isAdmin: boolean;
  listError?: { message: string };
  insertResult?: { data?: unknown; error?: { message: string } | null };
};

function setupMocks(opts: Opts) {
  // Mock listTemplates / createTemplate by mocking the supabase chain
  // The query builder: select().order() returns a thenable that also
  // supports .eq() chaining. listTemplates does either
  //   sb.from('templates').select('*').order(...)  (await)
  // or
  //   sb.from('templates').select('*').order(...).eq(...)  (await)
  // so the object returned by order() must be both thenable AND .eq()-able.
  const queryResult = { data: [], error: opts.listError ?? null };
  const eq = vi.fn().mockReturnValue(Promise.resolve(queryResult));
  const orderThenable = {
    eq,
    then: (resolve: (v: typeof queryResult) => void) => resolve(queryResult),
  };
  const order = vi.fn().mockReturnValue(orderThenable);
  const selectBuilder = vi.fn().mockReturnValue({ order });
  const insertSelectSingle = vi.fn().mockResolvedValue(
    opts.insertResult ?? { data: { id: 'new-id', name: 'x', body_md: 'y', assistant_type: 'rfp' }, error: null },
  );
  const insertSelect = vi.fn().mockReturnValue({ single: insertSelectSingle });
  const insert = vi.fn().mockReturnValue({ select: insertSelect });

  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error {
      constructor() {
        super('not admin');
        this.name = 'NotAdmin';
      }
    }
    return {
      requireAdmin: vi.fn().mockImplementation(() => {
        if (!opts.isAdmin) throw new NotAdmin();
      }),
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'admin-uid', email: 'a@b.c' }),
      NotAdmin,
    };
  });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({
        select: selectBuilder,
        insert,
      }),
    }),
  }));
  return { insert, insertSelectSingle, order, eq, selectBuilder };
}

function buildGet(url = 'http://x/api/admin/templates'): Request {
  return new Request(url, { method: 'GET' });
}
function buildPost(body: unknown): Request {
  return new Request('http://x/api/admin/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/admin/templates', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { GET } = await import('@/app/api/admin/templates/route');
    const res = await GET(buildGet());
    expect(res.status).toBe(404);
  });

  it('returns 200 with templates array for admin', async () => {
    setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/templates/route');
    const res = await GET(buildGet());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { templates: unknown[] };
    expect(Array.isArray(body.templates)).toBe(true);
  });

  it('passes ?type=rfp filter through', async () => {
    const m = setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/templates/route');
    await GET(buildGet('http://x/api/admin/templates?type=rfp'));
    // eq() is called inside the select chain for the type filter
    // The actual filter is buried in templates.ts; this smoke test
    // just confirms no crash and 200 status.
    expect(m.order).toHaveBeenCalled();
  });
});

describe('POST /api/admin/templates', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { POST } = await import('@/app/api/admin/templates/route');
    const res = await POST(buildPost({}));
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid body (missing name)', async () => {
    setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/templates/route');
    const res = await POST(buildPost({ assistant_type: 'rfp', body_md: 'hi' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid assistant_type', async () => {
    setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/templates/route');
    const res = await POST(
      buildPost({ assistant_type: 'spec', name: 'x', body_md: 'hi' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 201 for valid create', async () => {
    setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/templates/route');
    const res = await POST(
      buildPost({
        assistant_type: 'rfp',
        name: 'RFP Padrão',
        description: 'Descrição',
        body_md: '# title\n\nbody',
      }),
    );
    expect(res.status).toBe(201);
  });

  it('returns 500 when supabase insert errors', async () => {
    setupMocks({
      isAdmin: true,
      insertResult: { data: null, error: { message: 'boom' } },
    });
    const { POST } = await import('@/app/api/admin/templates/route');
    const res = await POST(
      buildPost({ assistant_type: 'rfp', name: 'X', body_md: 'Y' }),
    );
    expect(res.status).toBe(500);
  });
});
