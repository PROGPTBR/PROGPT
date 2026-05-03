#!/usr/bin/env tsx
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getServerSupabase } from '@/lib/db/supabase';
import { runRag } from '@/lib/rag';
import { embed } from '@/lib/llm/voyage';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';

const RECALL_THRESHOLD = 0.85;

type GoldenRow = {
  id: string;
  query: string;
  expected_titles: string[];
  intent: string;
};

type RowResult = {
  id: string;
  intent: string;
  hit: boolean | 'inconclusive' | 'n/a';
  rank: number | null;
  smalltalkSkippedCorrectly: boolean | null;
  totalMs: number;
};

async function resolveExpectedIds(
  rows: GoldenRow[],
): Promise<Map<string, Set<string>>> {
  const allTitles = [...new Set(rows.flatMap((r) => r.expected_titles))];
  if (allTitles.length === 0) return new Map();
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from('articles').select('id,title').in('title', allTitles);
  if (error) throw new Error(`articles lookup failed: ${error.message}`);
  const titleToId = new Map<string, string>();
  for (const a of (data as { id: string; title: string }[]) ?? []) {
    titleToId.set(a.title, a.id);
  }
  const out = new Map<string, Set<string>>();
  for (const row of rows) {
    const ids = new Set<string>();
    for (const t of row.expected_titles) {
      const id = titleToId.get(t);
      if (id) ids.add(id);
    }
    out.set(row.id, ids);
  }
  return out;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

export async function runEval(): Promise<void> {
  const goldenPath = resolve(process.cwd(), 'scripts/eval/golden.json');
  const rows = JSON.parse(readFileSync(goldenPath, 'utf-8')) as GoldenRow[];
  const expectedIds = await resolveExpectedIds(rows);

  const commit = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';
  const sessionId = `eval-${new Date().toISOString().slice(0, 10)}-${commit}`;

  // Single batched embed call for ALL queries upfront — eliminates Voyage 3 RPM throttle.
  const queryVectors = await embed(rows.map((r) => r.query), 'query');

  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const trace = await startTrace({
      name: 'eval.pair',
      sessionId,
      input: { query: row.query, intent: row.intent },
      tags: ['env:ci', `commit:${commit}`, `intent:${row.intent}`],
    });

    const ragResult = await runRag(row.query, {
      parentTrace: trace,
      _preEmbeddedQuery: queryVectors[i],
    });

    const expected = expectedIds.get(row.id) ?? new Set<string>();

    let hit: RowResult['hit'];
    let rank: number | null = null;
    let smalltalkSkippedCorrectly: boolean | null = null;

    if (row.intent === 'smalltalk') {
      smalltalkSkippedCorrectly = !ragResult.classification.needsRetrieval;
      hit = 'n/a';
    } else if (expected.size === 0) {
      hit = 'inconclusive';
    } else {
      const top5 = ragResult.sources.slice(0, 5).map((s) => s.articleId);
      const idx = top5.findIndex((id) => expected.has(id));
      if (idx >= 0) {
        hit = true;
        rank = idx + 1;
      } else {
        hit = false;
      }
    }

    trace.end({
      hit,
      rank,
      sources: ragResult.sources.slice(0, 5),
      classification: ragResult.classification,
    });

    results.push({
      id: row.id,
      intent: row.intent,
      hit,
      rank,
      smalltalkSkippedCorrectly,
      totalMs: Math.round(ragResult.debug.totalMs),
    });
  }

  await flushAsync();

  const scoreable = results.filter((r) => r.hit === true || r.hit === false);
  const hits = scoreable.filter((r) => r.hit === true);
  const recallAt5 = scoreable.length > 0 ? hits.length / scoreable.length : 0;
  const mrr =
    scoreable.length > 0
      ? scoreable.reduce((acc, r) => acc + (r.rank ? 1 / r.rank : 0), 0) / scoreable.length
      : 0;
  const smalltalk = results.filter((r) => r.intent === 'smalltalk');
  const smalltalkCorrect = smalltalk.filter((r) => r.smalltalkSkippedCorrectly === true).length;
  const smalltalkRate = smalltalk.length > 0 ? smalltalkCorrect / smalltalk.length : 1;
  const meanLatency =
    results.length > 0 ? results.reduce((acc, r) => acc + r.totalMs, 0) / results.length : 0;

  console.log('\n| id | intent | hit | rank | latency_ms |');
  console.log('|---|---|---|---|---|');
  for (const r of results) {
    const hitStr = r.hit === true ? 'HIT' : r.hit === false ? 'miss' : String(r.hit);
    const rankStr = r.rank ? String(r.rank) : '-';
    console.log(
      `| ${pad(r.id, 30)} | ${pad(r.intent, 14)} | ${pad(hitStr, 12)} | ${pad(rankStr, 4)} | ${pad(String(r.totalMs), 8)} |`,
    );
  }
  console.log('');
  console.log(`recall@5            : ${recallAt5.toFixed(2)} (${hits.length}/${scoreable.length})`);
  console.log(`MRR                 : ${mrr.toFixed(3)}`);
  console.log(`smalltalk-skip-rate : ${smalltalkRate.toFixed(2)} (${smalltalkCorrect}/${smalltalk.length})`);
  console.log(`mean total latency  : ${meanLatency.toFixed(0)} ms`);

  writeFileSync(
    resolve(process.cwd(), 'scripts/eval/results.json'),
    JSON.stringify(
      { results, recallAt5, mrr, smalltalkRate, meanLatency, threshold: RECALL_THRESHOLD, commit, sessionId },
      null,
      2,
    ),
  );

  if (recallAt5 < RECALL_THRESHOLD) {
    console.error(`FAIL: recall@5 ${recallAt5.toFixed(2)} < ${RECALL_THRESHOLD}`);
    process.exit(1);
  }
  process.exit(0);
}

// Only run when invoked as a script (not when imported by tests).
// tsx transpiles .ts to CJS by default, so require.main === module works.
const isMainModule =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (isMainModule || process.env.RUN_EVAL_AS_MAIN === '1') {
  runEval().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
