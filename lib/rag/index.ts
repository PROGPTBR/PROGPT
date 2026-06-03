import { classify } from './classifier';
import { retrieve } from './retriever';
import { rerank } from './reranker';
import { buildPrompt, buildLibraryOverviewPrompt } from './prompt-builder';
import { getLibrarySnapshot } from './library-snapshot';
import type { ProfileSnapshot, RagResult, RetrievedChunk } from './types';
import type { Trace } from '@/lib/observability/types';

// Quantos trechos chegam ao prompt após o rerank. Subido de 8 → 12 (sub-projeto
// 32) pra dar mais material da base ao modelo elaborar respostas com a
// profundidade que o SYSTEM_PROMPT exige. retrieve() entrega 30 candidatos;
// MIN_RELEVANCE (0.10) ainda descarta ruído. Gate: recall@5 ≥ 0.85 (rag:eval).
const RERANK_TOP_N = 12;

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
  //
  // EXCEPTION (sub-projeto 34 follow-up): when the user has a Perfil
  // ativo, questions like "me conte sobre minha categoria" / "quais
  // subcategorias" misfire as library_overview but the answer should
  // come from the active Profile, not from the library snapshot. We
  // skip this short-circuit when profileContext is set so the query
  // falls through to the standard retrieval + prompt-builder path,
  // where the <active-profile> block is included in the user message.
  // supplier_search short-circuits everything. The chat doesn't have
  // CNPJ data — that lives in the external Receita DB consumed by the
  // /assistants/suppliers flow. Here we just acknowledge in 1 line and
  // attach an annotation (in /api/chat) that the frontend reads to
  // render a CTA card that opens the dedicated assistant pré-preenchido.
  if (classification.intent === 'supplier_search') {
    trace?.setTag('intent:supplier_search');
    const lang = classification.language;
    const system =
      lang === 'en'
        ? 'You are a procurement assistant. Reply in ONE short sentence in English acknowledging that you will open the Supplier Search for the user. Do not invent supplier names, CNPJs, or contact info — those will be loaded by the dedicated tool.'
        : 'Você é um assistente de procurement. Responda em UMA frase curta em PT-BR reconhecendo que vai abrir a Busca de Fornecedores. NÃO invente nomes de empresas, CNPJs ou contatos — esses dados serão carregados pela ferramenta dedicada.';
    return {
      classification,
      chunks: [],
      sources: [],
      system,
      user: query,
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

  if (classification.intent === 'library_overview' && !opts.profileContext) {
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

  // When a Perfil is active and the classifier marked the turn as
  // library_overview (which carries needsRetrieval=false), force
  // retrieval back on. The user wants the answer grounded in BOTH
  // their category AND the article corpus — explicit request:
  // "relacionar este contexto com as teorias dos artigos que temos".
  const forceRetrievalForProfile =
    !!opts.profileContext && classification.intent === 'library_overview';
  if (classification.needsRetrieval || forceRetrievalForProfile) {
    if (forceRetrievalForProfile) {
      trace?.setTag('profile-overrides-library_overview');
    }
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
