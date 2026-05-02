import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { RetrievedChunk } from '@/lib/rag/types';

beforeEach(() => {
  process.env.COHERE_API_KEY = 'test-key';
  process.env.COHERE_RERANK_MODEL = 'rerank-multilingual-v3.0';
  vi.resetModules();
});

function chunk(id: string, content: string, rrfScore: number): RetrievedChunk {
  return {
    chunkId: id,
    articleId: `art-${id}`,
    content,
    ord: 0,
    articleTitle: `Title ${id}`,
    vectorRank: null,
    ftsRank: null,
    rrfScore,
    rerankScore: null,
  };
}

describe('rag reranker', () => {
  it('returns empty without calling Cohere when input is empty', async () => {
    const cohereSpy = vi.fn();
    vi.doMock('@/lib/llm/cohere', () => ({ rerank: cohereSpy }));
    const { rerank } = await import('@/lib/rag/reranker');
    const out = await rerank('q', [], 5);
    expect(out).toEqual([]);
    expect(cohereSpy).not.toHaveBeenCalled();
  });

  it('reorders chunks by Cohere index and annotates rerankScore', async () => {
    vi.doMock('@/lib/llm/cohere', () => ({
      rerank: vi.fn().mockResolvedValue([
        { index: 2, relevanceScore: 0.95 },
        { index: 0, relevanceScore: 0.7 },
      ]),
    }));
    const input = [chunk('A', 'a', 0.5), chunk('B', 'b', 0.4), chunk('C', 'c', 0.3)];
    const { rerank } = await import('@/lib/rag/reranker');
    const out = await rerank('q', input, 2);
    expect(out.map((c) => c.chunkId)).toEqual(['C', 'A']);
    expect(out[0]?.rerankScore).toBe(0.95);
    expect(out[1]?.rerankScore).toBe(0.7);
  });

  it('falls back to RRF order on Cohere failure', async () => {
    vi.doMock('@/lib/llm/cohere', () => ({
      rerank: vi.fn().mockRejectedValue(new Error('cohere down')),
    }));
    const input = [chunk('A', 'a', 0.5), chunk('B', 'b', 0.4), chunk('C', 'c', 0.3)];
    const { rerank } = await import('@/lib/rag/reranker');
    const out = await rerank('q', input, 2);
    expect(out.map((c) => c.chunkId)).toEqual(['A', 'B']);
    expect(out[0]?.rerankScore).toBeNull();
  });
});
