import { NextResponse } from 'next/server';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/db/supabase-server';
import { CANONICAL_THEMES, isCanonicalTheme } from '@/lib/ingest/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ThemeRow = {
  theme: string;
  status: 'canonical' | 'candidate';
  count: number;
  inConstant: boolean;
};

// GET /api/admin/themes — aggregated list of every theme currently in use,
// PLUS canonical-constant entries that have zero articles (so the admin
// page can still show them as targets for merge/rename operations).
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const sb = supabaseServer();
  // Pull all rows; group in memory. The corpus is <1k articles for now;
  // when it grows we move to a SQL aggregate RPC.
  const { data, error } = await sb.from('articles').select('theme, theme_status');
  if (error) return NextResponse.json({ error: 'select_failed' }, { status: 500 });

  const map = new Map<string, ThemeRow>();
  for (const row of (data ?? []) as Array<{ theme: string; theme_status: ThemeRow['status'] }>) {
    const existing = map.get(row.theme);
    if (existing) {
      existing.count += 1;
      // If any row is candidate, surface that status; admin sees the worst case.
      if (row.theme_status === 'candidate') existing.status = 'candidate';
    } else {
      map.set(row.theme, {
        theme: row.theme,
        status: row.theme_status,
        count: 1,
        inConstant: isCanonicalTheme(row.theme),
      });
    }
  }

  // Surface CANONICAL_THEMES even if currently empty — those are valid merge
  // targets and should remain visible in the admin UI.
  for (const t of CANONICAL_THEMES) {
    if (!map.has(t)) {
      map.set(t, { theme: t, status: 'canonical', count: 0, inConstant: true });
    }
  }

  // Sort: canonical-in-constant first (alphabetic), then other canonical by
  // count desc, then candidates by count desc.
  const rows = [...map.values()].sort((a, b) => {
    const aRank = a.inConstant ? 0 : a.status === 'canonical' ? 1 : 2;
    const bRank = b.inConstant ? 0 : b.status === 'canonical' ? 1 : 2;
    if (aRank !== bRank) return aRank - bRank;
    if (aRank === 0) return a.theme.localeCompare(b.theme, 'pt-BR');
    return b.count - a.count;
  });

  return NextResponse.json({ themes: rows });
}
