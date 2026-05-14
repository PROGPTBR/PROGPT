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

  // The list query builder: from(...).select(...).eq(...).order(...).limit(...)
  const queryResult = { data: opts.rows ?? [], error: null };
  const limit = vi.fn().mockResolvedValue(queryResult);
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({ select }),
    }),
  }));
  return { select, eq, order, limit };
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
    expect(m.limit).toHaveBeenCalledWith(10);
  });
});
