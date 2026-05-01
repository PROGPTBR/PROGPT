import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  process.env.COHERE_API_KEY = 'test-key';
  process.env.COHERE_RERANK_MODEL = 'rerank-multilingual-v3.0';
  vi.resetModules();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('cohere rerank', () => {
  it('posts to /v2/rerank and returns results sorted by relevance', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { index: 1, relevance_score: 0.9 },
            { index: 0, relevance_score: 0.4 },
          ],
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const { rerank } = await import('@/lib/llm/cohere');
    const result = await rerank('query', ['doc a', 'doc b'], 2);

    expect(result).toEqual([
      { index: 1, relevanceScore: 0.9 },
      { index: 0, relevanceScore: 0.4 },
    ]);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://api.cohere.com/v2/rerank');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-key',
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      model: 'rerank-multilingual-v3.0',
      query: 'query',
      documents: ['doc a', 'doc b'],
      top_n: 2,
    });
  });

  it('throws on non-200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('boom', { status: 500 }),
    ) as typeof fetch;

    const { rerank } = await import('@/lib/llm/cohere');
    await expect(rerank('q', ['d'], 1)).rejects.toThrow(/cohere/i);
  });

  it('returns empty array without calling fetch when documents is empty', async () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as typeof fetch;

    const { rerank } = await import('@/lib/llm/cohere');
    const result = await rerank('q', [], 5);

    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
