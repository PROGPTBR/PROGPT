import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

type Opts = {
  authed?: boolean;
  rows?: unknown[];
};

function setupMocks(opts: Opts = {}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi
      .fn()
      .mockResolvedValue(opts.authed === false ? null : { id: 'u-1', email: 'u@x.y' }),
  }));

  // The list query builder. After sub-projeto 32 the builder also has
  // `.lt('created_at', cursor)` when a cursor is passed; we install lt
  // on the same intermediate so either branch is observable.
  const queryResult = { data: opts.rows ?? [], error: null };
  // The cursor branch ends at .lt(...); the no-cursor branch ends at
  // .limit(...). Both must resolve to the query result.
  const lt = vi.fn().mockResolvedValue(queryResult);
  const limit = vi.fn().mockReturnValue({ lt, then: undefined });
  // limit() needs to be both awaitable (no-cursor path) and chainable
  // via .lt() (cursor path). vitest mocks allow attaching .then via a
  // thenable, but the simpler approach is to make limit() return a
  // promise-like that also exposes lt. We do that with a Proxy.
  const limitResult = {
    lt,
    then: (resolve: (v: unknown) => void) => resolve(queryResult),
  };
  limit.mockReturnValue(limitResult);
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({ select }),
    }),
  }));
  return { select, eq, order, limit, lt };
}

function buildGet(url = 'http://x/api/assistants/runs'): Request {
  return new Request(url, { method: 'GET' });
}

describe('GET /api/assistants/runs', () => {
  it('returns 401 when not authenticated', async () => {
    setupMocks({ authed: false });
    const { GET } = await import('@/app/api/assistants/runs/route');
    const res = await GET(buildGet());
    expect(res.status).toBe(401);
  });

  it('returns 200 with an empty array when the user has no runs', async () => {
    setupMocks({ rows: [] });
    const { GET } = await import('@/app/api/assistants/runs/route');
    const res = await GET(buildGet());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { runs: unknown[] };
    expect(Array.isArray(body.runs)).toBe(true);
    expect(body.runs.length).toBe(0);
  });

  it('returns 200 with run rows when the user has runs', async () => {
    setupMocks({
      rows: [
        {
          id: 'r-1',
          assistant_type: 'rfp',
          template_id: 't-1',
          params: { scope: 'Software ERP', category: 'TI', client: 'ACME' },
          status: 'done',
          error_message: null,
          created_at: '2026-05-12T10:00:00Z',
          finished_at: '2026-05-12T10:01:30Z',
        },
      ],
    });
    const { GET } = await import('@/app/api/assistants/runs/route');
    const res = await GET(buildGet());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      runs: { id: string; params: { client?: string } }[];
    };
    expect(body.runs.length).toBe(1);
    expect(body.runs[0]!.id).toBe('r-1');
    expect(body.runs[0]!.params.client).toBe('ACME');
  });

  it('honors ?limit= query param (bounded to [1, 200])', async () => {
    const m = setupMocks({ rows: [] });
    const { GET } = await import('@/app/api/assistants/runs/route');
    await GET(buildGet('http://x/api/assistants/runs?limit=10'));
    // Server fetches limit+1 rows to detect whether a next page exists
    // without an extra COUNT query.
    expect(m.limit).toHaveBeenCalledWith(11);
  });

  it('passes ?cursor= to a created_at LT filter', async () => {
    const m = setupMocks({ rows: [] });
    const { GET } = await import('@/app/api/assistants/runs/route');
    await GET(
      buildGet(
        'http://x/api/assistants/runs?cursor=2026-05-15T10%3A00%3A00Z',
      ),
    );
    expect(m.lt).toHaveBeenCalledWith('created_at', '2026-05-15T10:00:00Z');
  });
});
