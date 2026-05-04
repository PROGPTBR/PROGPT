import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { RetrievedChunk } from '@/lib/rag/types';

beforeEach(() => {
  vi.resetModules();
});

function chunk(id: string, content: string): RetrievedChunk {
  return {
    chunkId: id,
    articleId: `art-${id}`,
    content,
    ord: 0,
    articleTitle: `Title ${id}`,
    vectorRank: null,
    ftsRank: null,
    rrfScore: 0,
    rerankScore: null,
  };
}

describe('rerank', () => {
  it('keeps chunks with relevanceScore >= MIN_RELEVANCE', async () => {
    vi.doMock('@/lib/llm/cohere', () => ({
      rerank: vi.fn().mockResolvedValue([
        { index: 0, relevanceScore: 0.9 },
        { index: 1, relevanceScore: 0.5 },
      ]),
    }));
    const { rerank } = await import('@/lib/rag/reranker');
    const result = await rerank('q', [chunk('a', 'aaa'), chunk('b', 'bbb')], 5);
    expect(result.map((c) => c.chunkId)).toEqual(['a', 'b']);
  });

  it('filters out chunks with relevanceScore < MIN_RELEVANCE', async () => {
    vi.doMock('@/lib/llm/cohere', () => ({
      rerank: vi.fn().mockResolvedValue([
        { index: 0, relevanceScore: 0.5 },
        { index: 1, relevanceScore: 0.05 },
      ]),
    }));
    const { rerank } = await import('@/lib/rag/reranker');
    const result = await rerank('q', [chunk('a', 'aaa'), chunk('b', 'bbb')], 5);
    expect(result.map((c) => c.chunkId)).toEqual(['a']);
  });

  it('returns empty array when every score is below threshold', async () => {
    vi.doMock('@/lib/llm/cohere', () => ({
      rerank: vi.fn().mockResolvedValue([
        { index: 0, relevanceScore: 0.02 },
        { index: 1, relevanceScore: 0.04 },
      ]),
    }));
    const { rerank } = await import('@/lib/rag/reranker');
    const result = await rerank('q', [chunk('a', 'aaa'), chunk('b', 'bbb')], 5);
    expect(result).toEqual([]);
  });

  it('falls back to RRF order when Cohere throws', async () => {
    vi.doMock('@/lib/llm/cohere', () => ({
      rerank: vi.fn().mockRejectedValue(new Error('cohere down')),
    }));
    const { rerank } = await import('@/lib/rag/reranker');
    const result = await rerank('q', [chunk('a', 'aaa'), chunk('b', 'bbb')], 1);
    expect(result.map((c) => c.chunkId)).toEqual(['a']);
  });

  it('returns [] when given no candidates', async () => {
    vi.doMock('@/lib/llm/cohere', () => ({ rerank: vi.fn() }));
    const { rerank } = await import('@/lib/rag/reranker');
    expect(await rerank('q', [], 5)).toEqual([]);
  });
});
