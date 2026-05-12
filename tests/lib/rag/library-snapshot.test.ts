import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockSupabase(opts: {
  rows?: Array<{ theme: string; theme_status: 'canonical' | 'candidate' }>;
  error?: { message: string };
}) {
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({
        select: () =>
          Promise.resolve({ data: opts.rows ?? [], error: opts.error ?? null }),
      }),
    }),
  }));
}

describe('getLibrarySnapshot', () => {
  it('groups rows by theme and counts them, sorted by count desc', async () => {
    mockSupabase({
      rows: [
        { theme: 'Kraljic', theme_status: 'canonical' },
        { theme: 'Kraljic', theme_status: 'canonical' },
        { theme: 'Kraljic', theme_status: 'canonical' },
        { theme: 'TCO', theme_status: 'canonical' },
        { theme: 'Gestão de Projetos', theme_status: 'candidate' },
        { theme: 'Gestão de Projetos', theme_status: 'candidate' },
      ],
    });
    const { getLibrarySnapshot } = await import('@/lib/rag/library-snapshot');
    const snap = await getLibrarySnapshot();
    expect(snap.totalArticles).toBe(6);
    expect(snap.themes).toHaveLength(3);
    expect(snap.themes[0]).toMatchObject({ theme: 'Kraljic', count: 3, status: 'canonical' });
    expect(snap.themes[1]).toMatchObject({ theme: 'Gestão de Projetos', count: 2, status: 'candidate' });
    expect(snap.themes[2]).toMatchObject({ theme: 'TCO', count: 1, status: 'canonical' });
  });

  it('returns empty arrays when corpus is empty', async () => {
    mockSupabase({ rows: [] });
    const { getLibrarySnapshot } = await import('@/lib/rag/library-snapshot');
    const snap = await getLibrarySnapshot();
    expect(snap.totalArticles).toBe(0);
    expect(snap.themes).toEqual([]);
  });

  it('returns empty snapshot (fail-soft) on supabase error', async () => {
    mockSupabase({ error: { message: 'boom' } });
    const { getLibrarySnapshot } = await import('@/lib/rag/library-snapshot');
    const snap = await getLibrarySnapshot();
    // Snapshot must not throw — meta-query flow falls back gracefully
    expect(snap.totalArticles).toBe(0);
    expect(snap.themes).toEqual([]);
  });

  it('surfaces worst-case status when a theme has mixed candidate/canonical rows', async () => {
    mockSupabase({
      rows: [
        // Use a theme name that is NOT in the CANONICAL_THEMES constant so
        // status is taken from the DB rows (not overridden by isCanonicalTheme)
        { theme: 'Custom Theme', theme_status: 'canonical' },
        { theme: 'Custom Theme', theme_status: 'canonical' },
        { theme: 'Custom Theme', theme_status: 'candidate' }, // pulls overall to candidate
      ],
    });
    const { getLibrarySnapshot } = await import('@/lib/rag/library-snapshot');
    const snap = await getLibrarySnapshot();
    expect(snap.themes[0]).toMatchObject({ theme: 'Custom Theme', count: 3, status: 'candidate' });
  });

  it('forces status=canonical for themes that live in CANONICAL_THEMES even if DB row says candidate', async () => {
    // Defense: if someone (or a bug) tagged 'Kraljic' as candidate in the DB,
    // the meta-query path should still show it as canonical — it's the
    // classifier source of truth.
    mockSupabase({
      rows: [{ theme: 'Kraljic', theme_status: 'candidate' }],
    });
    const { getLibrarySnapshot } = await import('@/lib/rag/library-snapshot');
    const snap = await getLibrarySnapshot();
    expect(snap.themes[0]?.status).toBe('canonical');
  });
});
