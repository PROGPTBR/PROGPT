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

describe('DELETE /api/admin/ingest/jobs', () => {
  it('non-admin → 404', async () => {
    mockAuth('user');
    const { DELETE } = await import('@/app/api/admin/ingest/jobs/route');
    const res = await DELETE();
    expect(res.status).toBe(404);
  });

  // After sub-projeto 32 the DELETE handler also does a SELECT first to
  // gather storage_path for error rows (so it can remove the upload from
  // the bucket). The builder mock below is chainable AND awaitable so
  // both phases work: `.select(...).in(...).eq(...)` and
  // `.delete().in(...).eq(...).select('id')`.
  function buildChainableMock(opts: {
    selectData?: unknown[];
    storageRemove?: (paths: string[]) => void;
  } = {}) {
    const calls: Array<{ kind: string; payload?: unknown }> = [];
    const builder: Record<string, unknown> = {};
    const finalData = opts.selectData ?? [{ id: 'j1' }, { id: 'j2' }];
    builder.delete = vi.fn().mockImplementation(() => {
      calls.push({ kind: 'delete' });
      return builder;
    });
    builder.in = vi.fn().mockImplementation((col: string, vals: unknown[]) => {
      calls.push({ kind: 'in', payload: { col, vals } });
      return builder;
    });
    builder.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
      calls.push({ kind: 'eq', payload: { col, val } });
      // The first SELECT chain ends at .eq('user_id', userId) — has to be
      // awaitable. The DELETE chain continues past .eq into .select.
      return builder;
    });
    builder.select = vi.fn().mockImplementation((cols?: string) => {
      calls.push({ kind: 'select', payload: cols });
      return builder;
    });
    // Make builder awaitable: any `await builder` yields the configured
    // data. Both the SELECT-for-paths and the DELETE-with-select rely on
    // this.
    (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: finalData, error: null });

    const storage = {
      from: () => ({
        remove: vi.fn().mockImplementation(async (paths: string[]) => {
          opts.storageRemove?.(paths);
          return { error: null };
        }),
      }),
    };

    return {
      calls,
      mock: {
        from: () => builder,
        storage,
      },
    };
  }

  it('admin → deletes done+error jobs scoped to user, returns count', async () => {
    mockAuth('admin');
    const { calls, mock } = buildChainableMock();

    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => mock,
    }));

    const { DELETE } = await import('@/app/api/admin/ingest/jobs/route');
    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; deleted: number };
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(2);

    // Verify SOME .in(...) call used ['done', 'error']
    expect(
      calls.some(
        (c) =>
          c.kind === 'in' &&
          JSON.stringify((c.payload as { vals: unknown[] }).vals) ===
            JSON.stringify(['done', 'error']),
      ),
    ).toBe(true);
    // Verify scoped to user_id
    expect(
      calls.some(
        (c) =>
          c.kind === 'eq' && (c.payload as { col: string }).col === 'user_id',
      ),
    ).toBe(true);
  });

  it('admin → does not delete queued/running jobs', async () => {
    mockAuth('admin');
    const { calls, mock } = buildChainableMock({ selectData: [] });

    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => mock,
    }));

    const { DELETE } = await import('@/app/api/admin/ingest/jobs/route');
    await DELETE();

    // The statuses passed to .in() must NOT include 'queued' or 'running'
    const inCalls = calls
      .filter((c) => c.kind === 'in')
      .map((c) => (c.payload as { vals: unknown[] }).vals as string[]);
    for (const vals of inCalls) {
      expect(vals).not.toContain('queued');
      expect(vals).not.toContain('running');
    }
  });

  it('admin → removes storage files for error rows being deleted', async () => {
    mockAuth('admin');
    const removed: string[] = [];
    const { mock } = buildChainableMock({
      selectData: [
        { id: 'j1', status: 'done', storage_path: '<user>/done.pdf' },
        { id: 'j2', status: 'error', storage_path: '<user>/err.pdf' },
        { id: 'j3', status: 'error', storage_path: null },
      ],
      storageRemove: (paths) => {
        removed.push(...paths);
      },
    });

    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => mock,
    }));

    const { DELETE } = await import('@/app/api/admin/ingest/jobs/route');
    const res = await DELETE();
    expect(res.status).toBe(200);
    // Only the error row with a non-null storage_path triggers a remove.
    expect(removed).toEqual(['<user>/err.pdf']);
  });
});

describe('GET /api/admin/ingest/jobs', () => {
  it('admin → returns jobs array, runs cleanup pass (delete done > 7d, mark stale running as error)', async () => {
    mockAuth('admin');
    const calls: Array<{ kind: string; payload?: unknown }> = [];

    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => {
          const builder: Record<string, unknown> = {};
          builder.select = vi.fn().mockImplementation((cols: string) => {
            calls.push({ kind: 'select', payload: cols });
            return builder;
          });
          builder.update = vi.fn().mockImplementation((payload: unknown) => {
            calls.push({ kind: 'update', payload });
            return builder;
          });
          builder.delete = vi.fn().mockImplementation(() => {
            calls.push({ kind: 'delete' });
            return builder;
          });
          builder.in = vi.fn().mockReturnValue(builder);
          builder.eq = vi.fn().mockReturnValue(builder);
          builder.lt = vi.fn().mockReturnValue(builder);
          builder.order = vi.fn().mockResolvedValue({
            data: [{ id: 'j1', status: 'queued', created_at: '2026-05-03T10:00:00Z' }, { id: 'j2', status: 'done', created_at: '2026-05-03T09:00:00Z' }],
            error: null,
          });
          // Terminal for delete/update chains: simulate awaitable.
          builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
          return builder;
        },
        storage: {
          from: () => ({
            remove: vi.fn().mockResolvedValue({ error: null }),
          }),
        },
      }),
    }));
    const { GET } = await import('@/app/api/admin/ingest/jobs/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jobs: Array<{ id: string }> };
    expect(body.jobs).toHaveLength(2);
    expect(calls.some((c) => c.kind === 'delete')).toBe(true);
    expect(calls.some((c) => c.kind === 'update')).toBe(true);
  });

  it('non-admin → 404', async () => {
    mockAuth('user');
    const { GET } = await import('@/app/api/admin/ingest/jobs/route');
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
