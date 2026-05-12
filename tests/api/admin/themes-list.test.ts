import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

type Row = { theme: string; theme_status: 'canonical' | 'candidate' };

function setupMocks(opts: { isAdmin: boolean; rows?: Row[]; selectError?: { message: string } }) {
  const select = vi
    .fn()
    .mockResolvedValue({ data: opts.rows ?? [], error: opts.selectError ?? null });
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
      NotAdmin,
    };
  });
  vi.doMock('@/lib/db/supabase-server', () => ({
    supabaseServer: () => ({ from: () => ({ select }) }),
  }));
}

describe('GET /api/admin/themes', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { GET } = await import('@/app/api/admin/themes/route');
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('returns 500 when supabase errors', async () => {
    setupMocks({ isAdmin: true, selectError: { message: 'boom' } });
    const { GET } = await import('@/app/api/admin/themes/route');
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it('aggregates counts per theme + status', async () => {
    setupMocks({
      isAdmin: true,
      rows: [
        { theme: 'Kraljic', theme_status: 'canonical' },
        { theme: 'Kraljic', theme_status: 'canonical' },
        { theme: 'Gestão de Projetos', theme_status: 'candidate' },
        { theme: 'Gestão de Projetos', theme_status: 'candidate' },
        { theme: 'Gestão de Projetos', theme_status: 'candidate' },
      ],
    });
    const { GET } = await import('@/app/api/admin/themes/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { themes: Array<Record<string, unknown>> };
    const map = new Map<string, Record<string, unknown>>(
      body.themes.map((t) => [t.theme as string, t]),
    );
    expect(map.get('Kraljic')).toMatchObject({ count: 2, status: 'canonical', inConstant: true });
    expect(map.get('Gestão de Projetos')).toMatchObject({
      count: 3,
      status: 'candidate',
      inConstant: false,
    });
  });

  it('includes empty CANONICAL_THEMES entries as count=0 targets', async () => {
    setupMocks({ isAdmin: true, rows: [{ theme: 'Kraljic', theme_status: 'canonical' }] });
    const { GET } = await import('@/app/api/admin/themes/route');
    const res = await GET();
    const body = (await res.json()) as { themes: Array<{ theme: string; count: number }> };
    // Constants that are not present in articles should appear with count=0.
    const tco = body.themes.find((t) => t.theme === 'TCO');
    expect(tco).toBeDefined();
    expect(tco?.count).toBe(0);
  });

  it('marks a row candidate when ANY of its underlying rows is candidate (worst-case surfacing)', async () => {
    setupMocks({
      isAdmin: true,
      rows: [
        { theme: 'Foo', theme_status: 'canonical' },
        { theme: 'Foo', theme_status: 'candidate' },
      ],
    });
    const { GET } = await import('@/app/api/admin/themes/route');
    const res = await GET();
    const body = (await res.json()) as { themes: Array<{ theme: string; status: string }> };
    const foo = body.themes.find((t) => t.theme === 'Foo');
    expect(foo?.status).toBe('candidate');
  });

  it('sorts canonical-in-constant first (alphabetic), then by count desc', async () => {
    setupMocks({
      isAdmin: true,
      rows: [
        { theme: 'Custom Big', theme_status: 'candidate' },
        { theme: 'Custom Big', theme_status: 'candidate' },
        { theme: 'Custom Big', theme_status: 'candidate' },
        { theme: 'Custom Tiny', theme_status: 'candidate' },
      ],
    });
    const { GET } = await import('@/app/api/admin/themes/route');
    const res = await GET();
    const body = (await res.json()) as { themes: Array<{ theme: string }> };
    // First entries are canonical-in-constant (alphabetic Digital / Tecnologia, Kraljic...)
    // Custom ones land after.
    const customBigIndex = body.themes.findIndex((t) => t.theme === 'Custom Big');
    const customTinyIndex = body.themes.findIndex((t) => t.theme === 'Custom Tiny');
    // Bigger-count candidate appears before smaller-count candidate
    expect(customBigIndex).toBeLessThan(customTinyIndex);
    // Both come AFTER all CANONICAL_THEMES (since those are inConstant rank=0)
    const lastConstantIndex = Math.max(
      body.themes.findIndex((t) => t.theme === 'Outros'),
      body.themes.findIndex((t) => t.theme === 'Kraljic'),
    );
    expect(customBigIndex).toBeGreaterThan(lastConstantIndex);
  });
});
