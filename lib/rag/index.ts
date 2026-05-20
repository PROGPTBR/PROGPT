import { classify } from './classifier';
import { retrieve } from './retriever';
import { rerank } from './reranker';
import { buildPrompt, buildLibraryOverviewPrompt } from './prompt-builder';
import { getLibrarySnapshot } from './library-snapshot';
import type { ProfileSnapshot, RagResult, RetrievedChunk } from './types';
import type { Trace } from '@/lib/observability/types';

const RERANK_TOP_N = 8;

export type RunRagOpts = {
  parentTrace?: Trace;
  /** Internal hook for eval batching: skip embed call if vector already known. */
  _preEmbeddedQuery?: number[];
  /**
   * Sub-projeto 34 — Perfil da Categoria ativo no chat.
   *
   * When present, a Perfil block is prepended to the user message so the
   * LLM treats the active category as the lens for the answer. SYSTEM_PROMPT
   * is unchanged (prefix cache intact). Retriever is NOT biased — the
   * category influences only the prompt, never the query embedding.
   */
  profileContext?: ProfileSnapshot | null;
};

export async function runRag(query: string, opts: RunRagOpts = {}): Promise<RagResult> {
  const t0 = performance.now();
  const trace = opts.parentTrace;

  const tClassifyStart = performance.now();
  const classifySpan = trace?.span('classify', { query });
  const classification = await classify(query);
  classifySpan?.end({ classification });
  const classifyMs = performance.now() - tClassifyStart;

  let chunks: RetrievedChunk[] = [];
  let embedMs = 0;
  let vectorMs = 0;
  let ftsMs = 0;
  let rerankMs = 0;

  // library_overview short-circuits both retrieval AND the standard
  // prompt-builder. The data source is the DB snapshot, not the chunk
  // corpus, so any retrieval would just return noise.
  if (classification.intent === 'library_overview') {
    const snapshotSpan = trace?.span('library-snapshot', {});
    const snapshot = await getLibrarySnapshot();
    snapshotSpan?.end({
      totalArticles: snapshot.totalArticles,
      themeCount: snapshot.themes.length,
    });
    trace?.setTag('intent:library_overview');

    const promptSpan = trace?.span('build-prompt', { sources: 0, mode: 'library_overview' });
    const { system, user, sources } = buildLibraryOverviewPrompt(query, snapshot, classification);
    promptSpan?.end({ systemLen: system.length, userLen: user.length });

    return {
      classification,
      chunks: [],
      sources,
      system,
      user,
      debug: {
        classifyMs,
        embedMs: 0,
        vectorMs: 0,
        ftsMs: 0,
        rerankMs: 0,
        totalMs: performance.now() - t0,
      },
    };
  }

  if (classification.needsRetrieval) {
    const tRetrieveStart = performance.now();
    const retrieveSpan = trace?.span('retrieve', { query, k: 30 });
    const candidates = await retrieve(query, { preEmbedded: opts._preEmbeddedQuery });
    retrieveSpan?.end({ count: candidates.length });
    const retrieveMs = performance.now() - tRetrieveStart;
    embedMs = retrieveMs;
    vectorMs = retrieveMs;
    ftsMs = retrieveMs;

    const tRerankStart = performance.now();
    const rerankSpan = trace?.span('rerank', { candidates: candidates.length });
    chunks = await rerank(query, candidates, RERANK_TOP_N);
    const top1Score = chunks[0]?.rerankScore ?? null;
    rerankSpan?.end({ kept: chunks.length, top1Score });
    if (chunks.length === 0) trace?.setTag('low-confidence');
    rerankMs = performance.now() - tRerankStart;
  }

  const profileContext = opts.profileContext ?? null;
  if (profileContext) {
    trace?.setTag(`perfil:${profileContext.id}`);
  }
  const promptSpan = trace?.span('build-prompt', {
    sources: chunks.length,
    hasProfile: !!profileContext,
  });
  const { system, user, sources } = buildPrompt(
    query,
    chunks,
    classification,
    profileContext,
  );
  promptSpan?.end({ systemLen: system.length, userLen: user.length });

  return {
    classification,
    chunks,
    sources,
    system,
    user,
    debug: {
      classifyMs,
      embedMs,
      vectorMs,
      ftsMs,
      rerankMs,
      totalMs: performance.now() - t0,
    },
  };
}

export type {
  Classification,
  ProfileSnapshot,
  RetrievedChunk,
  SourceRef,
  RagResult,
} from './types';
