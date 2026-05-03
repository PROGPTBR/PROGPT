import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_EXIT = process.exit;

let tmpDir: string;
let exitCode: number | null;

beforeEach(() => {
  vi.resetModules();
  exitCode = null;
  tmpDir = mkdtempSync(join(tmpdir(), 'eval-test-'));
  const evalDir = join(tmpDir, 'scripts', 'eval');
  mkdirSync(evalDir, { recursive: true });
  process.chdir(tmpDir);
  // Override process.exit so we can assert the exit code.
  (process as NodeJS.Process & { exit: (code?: number) => never }).exit = ((code: number) => {
    exitCode = code;
    throw new Error(`__exit_${code}`);
  }) as never;
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit = ORIGINAL_EXIT;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function writeGolden(rows: unknown[]) {
  writeFileSync(
    join(tmpDir, 'scripts/eval/golden.json'),
    JSON.stringify(rows),
  );
}

describe('scripts/eval/run', () => {
  it('exits 0 when recall@5 ≥ 0.85 and writes results.json', async () => {
    writeGolden([
      { id: 'a', intent: 'definition', query: 'q1', expected_titles: ['T1'] },
      { id: 'b', intent: 'definition', query: 'q2', expected_titles: ['T2'] },
    ]);

    vi.doMock('@/lib/llm/voyage', () => ({
      embed: vi.fn().mockResolvedValue([new Array(1024).fill(0), new Array(1024).fill(0)]),
    }));
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => ({
          select: () => ({
            in: async () => ({
              data: [{ id: 'art-1', title: 'T1' }, { id: 'art-2', title: 'T2' }],
              error: null,
            }),
          }),
        }),
      }),
    }));
    vi.doMock('@/lib/rag', () => ({
      runRag: vi.fn().mockImplementation(async (q: string) => {
        const id = q === 'q1' ? 'art-1' : 'art-2';
        return {
          classification: { needsRetrieval: true, intent: 'definition', language: 'pt', theory: null },
          sources: [{ articleId: id, articleTitle: q.toUpperCase(), chunkId: 'c1', number: 1 }],
          system: '', user: '',
          debug: { totalMs: 10, classifyMs: 1, embedMs: 1, vectorMs: 1, ftsMs: 1, rerankMs: 1 },
        };
      }),
    }));
    vi.doMock('@/lib/observability/langfuse', () => ({
      startTrace: vi.fn().mockResolvedValue({
        span: () => ({ end: () => {} }),
        end: () => {}, setMetadata: () => {}, setTag: () => {},
      }),
      flushAsync: vi.fn().mockResolvedValue(undefined),
    }));

    try {
      const mod = await import('@/scripts/eval/run');
      await mod.runEval();
    } catch {
      // expected — process.exit throws
    }
    expect(exitCode).toBe(0);
    const results = JSON.parse(readFileSync(join(tmpDir, 'scripts/eval/results.json'), 'utf-8'));
    expect(results.recallAt5).toBe(1.0);
    expect(results.threshold).toBe(0.85);
  });

  it('exits 1 when recall@5 < 0.85', async () => {
    writeGolden([
      { id: 'a', intent: 'definition', query: 'q1', expected_titles: ['T1'] },
      { id: 'b', intent: 'definition', query: 'q2', expected_titles: ['T2'] },
    ]);
    vi.doMock('@/lib/llm/voyage', () => ({
      embed: vi.fn().mockResolvedValue([new Array(1024).fill(0), new Array(1024).fill(0)]),
    }));
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => ({
          select: () => ({
            in: async () => ({
              data: [{ id: 'art-1', title: 'T1' }, { id: 'art-2', title: 'T2' }],
              error: null,
            }),
          }),
        }),
      }),
    }));
    vi.doMock('@/lib/rag', () => ({
      runRag: vi.fn().mockResolvedValue({
        classification: { needsRetrieval: true, intent: 'definition', language: 'pt', theory: null },
        sources: [{ articleId: 'wrong', articleTitle: 'X', chunkId: 'c1', number: 1 }],
        system: '', user: '',
        debug: { totalMs: 10, classifyMs: 1, embedMs: 1, vectorMs: 1, ftsMs: 1, rerankMs: 1 },
      }),
    }));
    vi.doMock('@/lib/observability/langfuse', () => ({
      startTrace: vi.fn().mockResolvedValue({
        span: () => ({ end: () => {} }),
        end: () => {}, setMetadata: () => {}, setTag: () => {},
      }),
      flushAsync: vi.fn().mockResolvedValue(undefined),
    }));

    try {
      const mod = await import('@/scripts/eval/run');
      await mod.runEval();
    } catch {
      // expected
    }
    expect(exitCode).toBe(1);
  });
});
