#!/usr/bin/env tsx
/**
 * Targeted reclassification: re-runs classifyContent on every article
 * currently in the "Outros" bucket and updates ONLY theme + theme_status
 * (title and summary are preserved — sub-projeto 13 already curated those).
 *
 * Use this after sub-projeto 16 (open taxonomy) lands to recover real
 * themes from articles that were force-bucketed under the old closed
 * taxonomy.
 *
 * Flags:
 *   --dry-run        Run classify but don't write to DB.
 *   --include-canon  Also re-run on articles already in a canonical
 *                    theme (useful if you suspect older classifications
 *                    were sub-optimal). Default: only "Outros".
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getServerSupabase } from '@/lib/db/supabase';
import { classifyContent } from '@/lib/ingest/classify-content';
import { CANONICAL_THEMES } from '@/lib/ingest/taxonomy';

type ArticleRow = {
  id: string;
  title: string;
  theme: string;
  raw_md: string | null;
  metadata: Record<string, unknown> | null;
};

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const includeCanon = process.argv.includes('--include-canon');
  const sb = getServerSupabase();

  let query = sb
    .from('articles')
    .select('id, title, theme, raw_md, metadata')
    .order('ingested_at', { ascending: true });
  if (!includeCanon) {
    query = query.eq('theme', 'Outros');
  }

  const { data, error } = await query;
  if (error) {
    console.error(`[reclassify-outros] select failed: ${error.message}`);
    process.exit(1);
  }
  const rows = (data ?? []) as ArticleRow[];
  console.log(
    `[reclassify-outros] processing ${rows.length} articles ${dryRun ? '(dry-run)' : '(LIVE)'}${
      includeCanon ? ' [include-canon]' : ' [Outros only]'
    }`,
  );

  const counts: Record<string, number> = {};
  let stayedOutros = 0;
  let movedCanonical = 0;
  let movedCandidate = 0;
  let failed = 0;

  for (const row of rows) {
    const filename =
      (row.metadata?.['source_filename'] as string | undefined) ?? row.id;
    if (!row.raw_md || row.raw_md.trim().length < 100) {
      console.warn(`[reclassify-outros] skip ${row.id.slice(0, 8)} — empty raw_md`);
      failed++;
      continue;
    }
    try {
      const c = await classifyContent(row.raw_md, filename);
      const beforeAfter = `${row.theme.padEnd(28)} → ${c.theme.padEnd(28)} [${c.themeStatus}]`;
      console.log(
        `[reclassify-outros] ${row.id.slice(0, 8)} ${beforeAfter} | ${row.title.slice(0, 50)}`,
      );
      counts[c.theme] = (counts[c.theme] ?? 0) + 1;
      if (c.theme === 'Outros') stayedOutros++;
      else if (c.themeStatus === 'canonical') movedCanonical++;
      else movedCandidate++;

      if (!dryRun) {
        const { error: upErr } = await sb
          .from('articles')
          .update({ theme: c.theme, theme_status: c.themeStatus })
          .eq('id', row.id);
        if (upErr) {
          console.error(`[reclassify-outros] update ${row.id}: ${upErr.message}`);
          failed++;
        }
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      console.error(`[reclassify-outros] classify failed ${row.id}: ${m}`);
      failed++;
    }
  }

  console.log('\n[reclassify-outros] summary');
  console.log(`  total processed: ${rows.length}`);
  console.log(`  moved to canonical (non-Outros): ${movedCanonical}`);
  console.log(`  moved to candidate (new theme):  ${movedCandidate}`);
  console.log(`  stayed in Outros:                 ${stayedOutros}`);
  console.log(`  failed/skipped:                   ${failed}`);
  console.log('\n[reclassify-outros] new distribution');
  for (const [t, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    const tag = (CANONICAL_THEMES as readonly string[]).includes(t) ? '' : ' [cand]';
    console.log(`  ${t.padEnd(36)} ${String(n).padStart(3)}${tag}`);
  }
}

main().catch((err) => {
  console.error('[reclassify-outros] fatal:', err);
  process.exit(1);
});
