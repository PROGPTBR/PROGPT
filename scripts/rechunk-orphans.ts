#!/usr/bin/env tsx
/**
 * Rechunks articles that have raw_md but zero chunks in the chunks table.
 *
 * Pipeline: same as runPipeline's text path:
 *   chunkText(raw_md) -> Voyage embed (batch 16) -> insert chunks (batch 50).
 *
 * Why this exists: on 2026-05-15 Supabase upstream was flaky during a mass
 * upload; ~259 article rows got inserted but their chunks failed silently
 * (pipeline.ts swallows .insert() errors). raw_md is intact, so we can
 * rebuild chunks without re-parsing or re-uploading.
 *
 * Usage:
 *   npx tsx scripts/rechunk-orphans.ts --dry-run   # plan only, no writes
 *   npx tsx scripts/rechunk-orphans.ts             # actually rechunk
 *   npx tsx scripts/rechunk-orphans.ts --limit 5   # process first N
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getServerSupabase } from '@/lib/db/supabase';
import { chunkText } from '@/lib/ingest/chunker';
import { embed } from '@/lib/llm/voyage';

const EMBED_BATCH = 16;
const INSERT_BATCH = 20;
const INSERT_RETRIES = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? '', 10) : 0;

  const sb = getServerSupabase();

  // Identify orphan articles by id-only first (cheap), then load raw_md per
  // article on demand. Selecting raw_md for all 500+ rows up front causes
  // Supabase statement timeouts.
  console.log('[rechunk] fetching all article ids (no raw_md)...');
  const allIds: string[] = [];
  const idTitles = new Map<string, { title: string; metadata: Record<string, unknown> | null }>();
  {
    let from = 0;
    const PAGE = 200;
    while (true) {
      const { data, error } = await sb
        .from('articles')
        .select('id, title, metadata')
        .order('ingested_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error(`[rechunk] articles page select failed: ${error.message}`);
        process.exit(1);
      }
      const rows = (data ?? []) as Array<{
        id: string;
        title: string;
        metadata: Record<string, unknown> | null;
      }>;
      for (const r of rows) {
        allIds.push(r.id);
        idTitles.set(r.id, { title: r.title, metadata: r.metadata });
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }

  console.log('[rechunk] fetching distinct article_ids that have chunks...');
  const articleIdsWithChunks = new Set<string>();
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await sb
        .from('chunks')
        .select('article_id')
        .range(from, from + PAGE - 1);
      if (error) {
        console.error(`[rechunk] chunks page select failed: ${error.message}`);
        process.exit(1);
      }
      const rows = (data ?? []) as Array<{ article_id: string }>;
      for (const r of rows) articleIdsWithChunks.add(r.article_id);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }

  const orphanIds = allIds.filter((id) => !articleIdsWithChunks.has(id));
  console.log(
    `[rechunk] total articles=${allIds.length} with_chunks=${articleIdsWithChunks.size} orphans=${orphanIds.length}`,
  );

  const targetIds = limit > 0 ? orphanIds.slice(0, limit) : orphanIds;
  console.log(
    `[rechunk] will process ${targetIds.length} orphan(s)${dryRun ? ' (dry-run)' : ''}`,
  );

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalChunks = 0;

  for (const id of targetIds) {
    const shortId = id.slice(0, 8);
    const meta = idTitles.get(id);
    const filename =
      (meta?.metadata?.['source_filename'] as string | undefined) ?? id;
    const title = meta?.title ?? '(unknown)';

    // Fetch raw_md just for this article (avoids global statement timeout).
    const { data: rmRow, error: rmErr } = await sb
      .from('articles')
      .select('raw_md')
      .eq('id', id)
      .single();
    if (rmErr || !rmRow) {
      console.warn(`[rechunk] skip ${shortId} — raw_md fetch failed: ${rmErr?.message ?? 'no row'}`);
      skipped++;
      continue;
    }
    const text = ((rmRow.raw_md as string | null) ?? '').trim();

    if (text.length < 100) {
      console.warn(`[rechunk] skip ${shortId} — raw_md too short (${text.length} chars)`);
      skipped++;
      continue;
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      console.warn(`[rechunk] skip ${shortId} — chunker produced 0 chunks`);
      skipped++;
      continue;
    }

    console.log(
      `[rechunk] ${shortId} "${title.slice(0, 60)}" → ${chunks.length} chunk(s)`,
    );

    if (dryRun) {
      totalChunks += chunks.length;
      processed++;
      continue;
    }

    try {
      // Embed in batches.
      const embeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
        const slice = chunks.slice(i, i + EMBED_BATCH);
        const out = await embed(slice, 'document');
        embeddings.push(...out);
      }
      if (embeddings.length !== chunks.length) {
        throw new Error(
          `embed count mismatch: chunks=${chunks.length} embeds=${embeddings.length}`,
        );
      }

      // Insert in batches of 50, CHECK FOR ERRORS (unlike the original
      // pipeline that swallowed them).
      const rows = chunks.map((content, idx) => ({
        article_id: id,
        ord: idx,
        content,
        embedding: embeddings[idx],
        metadata: { source_filename: filename, kind: 'text' as const },
      }));

      let inserted = 0;
      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        const batch = rows.slice(i, i + INSERT_BATCH);
        let lastErr: string | null = null;
        for (let attempt = 1; attempt <= INSERT_RETRIES; attempt++) {
          const { error: insErr } = await sb.from('chunks').insert(batch);
          if (!insErr) {
            lastErr = null;
            break;
          }
          lastErr = insErr.message;
          if (attempt < INSERT_RETRIES) {
            const backoff = 1000 * attempt;
            console.warn(
              `[rechunk]   retry insert offset=${i} attempt=${attempt}/${INSERT_RETRIES} after ${backoff}ms (${lastErr})`,
            );
            await sleep(backoff);
          }
        }
        if (lastErr) {
          throw new Error(`chunks insert failed at offset ${i}: ${lastErr}`);
        }
        inserted += batch.length;
      }
      console.log(`[rechunk]   ✓ inserted ${inserted}`);
      totalChunks += inserted;
      processed++;
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      console.error(`[rechunk]   ✗ FAILED ${shortId}: ${m}`);
      failed++;
    }
  }

  console.log(
    `\n[rechunk] done — processed=${processed} skipped=${skipped} failed=${failed} chunks_inserted=${totalChunks}`,
  );
}

main().catch((err) => {
  console.error('[rechunk] fatal:', err);
  process.exit(1);
});
