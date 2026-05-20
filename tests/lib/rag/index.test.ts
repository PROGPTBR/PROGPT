import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { RetrievedChunk } from '@/lib/rag/types';

beforeEach(() => {
  vi.resetModules();
});

function chunk(id: string): RetrievedChunk {
  return {
    chunkId: id,
    articleId: `art-${id}`,
    content: `content ${id}`,
    ord: 0,
    articleTitle: `Title ${id}`,
    vectorRank: 1,
    ftsRank: null,
    rrfScore: 0.5,
    rerankScore: null,
  };
}

describe('rag runRag', () => {
  it('runs the full pipeline and returns sources + system + user + debug', async () => {
    vi.doMock('@/lib/rag/classifier', () => ({
      classify: vi.fn().mockResolvedValue({
        theory: 'kraljic',
        intent: 'definition',
        language: 'pt',
        needsRetrieval: true,
      }),
    }));
    const retrieved = [chunk('a'), chunk('b')];
    vi.doMock('@/lib/rag/retriever', () => ({
      retrieve: vi.fn().mockResolvedValue(retrieved),
    }));
    vi.doMock('@/lib/rag/reranker', () => ({
      rerank: vi.fn().mockResolvedValue([
        { ...retrieved[0]!, rerankScore: 0.9 },
      ]),
    }));

    const { runRag } = await import('@/lib/rag');
    const result = await runRag('o que é kraljic?');

    expect(result.classification.theory).toBe('kraljic');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.chunkId).toBe('a');
    expect(result.user).not.toMatch(/\[\d+\]/);
    expect(result.system).toMatch(/especialista/i);
    expect(result.debug.totalMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.debug.classifyMs).toBe('number');
  });

  it('short-circuits retrieve and rerank when needsRetrieval is false', async () => {
    vi.doMock('@/lib/rag/classifier', () => ({
      classify: vi.fn().mockResolvedValue({
        theory: null,
        intent: 'smalltalk',
        language: 'pt',
        needsRetrieval: false,
      }),
    }));
    const retrieveSpy = vi.fn();
    const rerankSpy = vi.fn();
    vi.doMock('@/lib/rag/retriever', () => ({ retrieve: retrieveSpy }));
    vi.doMock('@/lib/rag/reranker', () => ({ rerank: rerankSpy }));

    const { runRag } = await import('@/lib/rag');
    const result = await runRag('oi');

    expect(retrieveSpy).not.toHaveBeenCalled();
    expect(rerankSpy).not.toHaveBeenCalled();
    expect(result.sources).toEqual([]);
    expect(result.system.toLowerCase()).toMatch(/não\s+(tenho|tem)\s+fonte/);
  });

  it('handles empty retrieved chunks by going through buildPrompt empty branch', async () => {
    vi.doMock('@/lib/rag/classifier', () => ({
      classify: vi.fn().mockResolvedValue({
        theory: null,
        intent: 'definition',
        language: 'pt',
        needsRetrieval: true,
      }),
    }));
    vi.doMock('@/lib/rag/retriever', () => ({
      retrieve: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('@/lib/rag/reranker', () => ({
      rerank: vi.fn().mockResolvedValue([]),
    }));

    const { runRag } = await import('@/lib/rag');
    const result = await runRag('pergunta sem fonte');
    expect(result.sources).toEqual([]);
    expect(result.system.toLowerCase()).toMatch(/não\s+(tenho|tem)\s+fonte/);
  });

  it('short-circuits retrieval AND uses the library-overview prompt when intent=library_overview (sub-projeto 18)', async () => {
    vi.doMock('@/lib/rag/classifier', () => ({
      classify: vi.fn().mockResolvedValue({
        theory: null,
        intent: 'library_overview',
        language: 'pt',
        needsRetrieval: false,
      }),
    }));
    const retrieveSpy = vi.fn();
    const rerankSpy = vi.fn();
    vi.doMock('@/lib/rag/retriever', () => ({ retrieve: retrieveSpy }));
    vi.doMock('@/lib/rag/reranker', () => ({ rerank: rerankSpy }));
    vi.doMock('@/lib/rag/library-snapshot', () => ({
      getLibrarySnapshot: vi.fn().mockResolvedValue({
        totalArticles: 96,
        themes: [
          { theme: 'Digital / Tecnologia', count: 19, status: 'canonical' },
          { theme: 'Gestão da Cadeia de Suprimentos', count: 11, status: 'candidate' },
          { theme: 'Risco / Resiliência', count: 10, status: 'canonical' },
        ],
      }),
    }));

    const { runRag } = await import('@/lib/rag');
    const result = await runRag('que temas você cobre?');

    expect(retrieveSpy).not.toHaveBeenCalled();
    expect(rerankSpy).not.toHaveBeenCalled();
    expect(result.chunks).toEqual([]);
    expect(result.sources).toEqual([]);
    // User prompt carries the actual snapshot data
    expect(result.user).toMatch(/Snapshot da base/);
    expect(result.user).toMatch(/Total de artigos: 96/);
    expect(result.user).toMatch(/Digital \/ Tecnologia/);
    expect(result.user).toMatch(/19 artigos/);
    expect(result.user).toMatch(/Gestão da Cadeia de Suprimentos/);
    expect(result.user).toMatch(/NÃO recuse/);
  });

  it('library_overview is OVERRIDDEN when profileContext is active (sub-projeto 34 follow-up)', async () => {
    // "me conte sobre minha categoria" gets classified as library_overview
    // by the LLM classifier, but with an active Perfil the answer should
    // come from the Profile + retrieved chunks, NOT the library snapshot.
    vi.doMock('@/lib/rag/classifier', () => ({
      classify: vi.fn().mockResolvedValue({
        theory: null,
        intent: 'library_overview',
        language: 'pt',
        needsRetrieval: false, // classifier sets this for library_overview
      }),
    }));
    const retrieved = [chunk('a')];
    const retrieveSpy = vi.fn().mockResolvedValue(retrieved);
    const rerankSpy = vi
      .fn()
      .mockResolvedValue([{ ...retrieved[0]!, rerankScore: 0.9 }]);
    vi.doMock('@/lib/rag/retriever', () => ({ retrieve: retrieveSpy }));
    vi.doMock('@/lib/rag/reranker', () => ({ rerank: rerankSpy }));
    const snapshotSpy = vi.fn();
    vi.doMock('@/lib/rag/library-snapshot', () => ({
      getLibrarySnapshot: snapshotSpy,
    }));

    const { runRag } = await import('@/lib/rag');
    const result = await runRag('me conte sobre minha categoria', {
      profileContext: {
        id: 'a8c8eb1c-1234-4def-8abc-1234567890ab',
        nomeCategoria: 'Embalagens flexíveis',
        descricao: 'Filmes laminados.',
        subSegmentos: ['filmes laminados'],
        escopoIncluido: 'Filmes mono e multicamada.',
        escopoNaoIncluido: '',
        requisitosTecnicos: 'ABNT NBR 14937.',
        restricoesRegulatorias: '',
        prioridadeEstrategica: 'qualidade',
      },
    });

    // Library snapshot is NOT consulted
    expect(snapshotSpy).not.toHaveBeenCalled();
    // Retrieval IS performed (forced on because user wants to relate to theory)
    expect(retrieveSpy).toHaveBeenCalled();
    expect(rerankSpy).toHaveBeenCalled();
    // User prompt has the active-profile block AND the chunk content
    expect(result.user).toMatch(/<active-profile>/);
    expect(result.user).toMatch(/Embalagens flexíveis/);
    // No library snapshot wording
    expect(result.user).not.toMatch(/Snapshot da base/);
  });

  it('library_overview English: prompts the model to respond in English', async () => {
    vi.doMock('@/lib/rag/classifier', () => ({
      classify: vi.fn().mockResolvedValue({
        theory: null,
        intent: 'library_overview',
        language: 'en',
        needsRetrieval: false,
      }),
    }));
    vi.doMock('@/lib/rag/retriever', () => ({ retrieve: vi.fn() }));
    vi.doMock('@/lib/rag/reranker', () => ({ rerank: vi.fn() }));
    vi.doMock('@/lib/rag/library-snapshot', () => ({
      getLibrarySnapshot: vi.fn().mockResolvedValue({
        totalArticles: 5,
        themes: [{ theme: 'Kraljic', count: 5, status: 'canonical' }],
      }),
    }));

    const { runRag } = await import('@/lib/rag');
    const result = await runRag('what topics do you cover?');
    expect(result.user).toMatch(/Library snapshot/);
    expect(result.user).toMatch(/Respond in English/);
  });

  it('opens spans on a provided parentTrace for classify, retrieve, rerank, build-prompt', async () => {
    vi.doMock('@/lib/rag/classifier', () => ({
      classify: vi.fn().mockResolvedValue({
        theory: 'kraljic', intent: 'definition', language: 'pt', needsRetrieval: true,
      }),
    }));
    const retrieved = [chunk('a'), chunk('b')];
    vi.doMock('@/lib/rag/retriever', () => ({
      retrieve: vi.fn().mockResolvedValue(retrieved),
    }));
    vi.doMock('@/lib/rag/reranker', () => ({
      rerank: vi.fn().mockResolvedValue([{ ...retrieved[0]!, rerankScore: 0.9 }]),
    }));

    const spans: Array<{ name: string; ended: boolean }> = [];
    const trace = {
      id: 'mock-trace-id',
      span: (name: string) => {
        const entry = { name, ended: false };
        spans.push(entry);
        return { end: () => { entry.ended = true; } };
      },
      end: () => {},
      setMetadata: () => {},
      setTag: () => {},
    };

    const { runRag } = await import('@/lib/rag');
    await runRag('o que é Kraljic?', { parentTrace: trace });
    const names = spans.map((s) => s.name);
    expect(names).toEqual(['classify', 'retrieve', 'rerank', 'build-prompt']);
    expect(spans.every((s) => s.ended)).toBe(true);
  });
});
