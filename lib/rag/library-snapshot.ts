import { getServerSupabase } from '@/lib/db/supabase';
import { isCanonicalTheme } from '@/lib/ingest/taxonomy';

export type LibraryThemeEntry = {
  theme: string;
  count: number;
  status: 'canonical' | 'candidate';
};

export type LibrarySnapshot = {
  totalArticles: number;
  themes: LibraryThemeEntry[];
};

/**
 * Snapshot of the current article corpus grouped by theme. Used by the
 * `library_overview` intent in runRag to ground meta-queries ("que temas você
 * cobre?") on real data instead of letting the LLM hallucinate a generic
 * procurement-themes list.
 *
 * Service-role: same pattern as /api/admin/themes — articles is RLS-gated
 * for unauthenticated reads, but service-role bypasses. Called from /api/chat
 * which is already auth-gated upstream, so widening through service-role
 * here is safe.
 *
 * Returns themes sorted by count desc (so the "top topics" presentation is
 * natural). When the corpus is empty (cold start), returns an empty themes
 * array — callers should fall back to a generic message.
 */
export async function getLibrarySnapshot(): Promise<LibrarySnapshot> {
  const sb = getServerSupabase();
  const { data, error } = await sb.from('articles').select('theme, theme_status');
  if (error) {
    console.warn('[rag/library-snapshot] select failed:', error.message);
    return { totalArticles: 0, themes: [] };
  }
  const rows = (data ?? []) as Array<{
    theme: string;
    theme_status: 'canonical' | 'candidate';
  }>;
  const map = new Map<string, LibraryThemeEntry>();
  for (const r of rows) {
    const existing = map.get(r.theme);
    if (existing) {
      existing.count += 1;
      // Surface worst-case status — same convention as /api/admin/themes.
      if (r.theme_status === 'candidate') existing.status = 'candidate';
    } else {
      map.set(r.theme, {
        theme: r.theme,
        count: 1,
        // Defensive: if a row's theme_status is canonical but theme isn't in
        // the constant, still trust the DB value — admin may have promoted
        // it. The classifier injection just cares about user-visible
        // canonicity.
        status: isCanonicalTheme(r.theme) ? 'canonical' : r.theme_status,
      });
    }
  }
  const themes = [...map.values()].sort((a, b) => b.count - a.count);
  return { totalArticles: rows.length, themes };
}
