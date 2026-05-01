import { requireEnv } from '@/lib/env';

const ENDPOINT = 'https://api.cohere.com/v2/rerank';
const TIMEOUT_MS = 30_000;

export interface RerankHit {
  index: number;
  relevanceScore: number;
}

export async function rerank(
  query: string,
  documents: string[],
  topN: number,
): Promise<RerankHit[]> {
  if (documents.length === 0) return [];

  const apiKey = requireEnv('COHERE_API_KEY');
  const model = requireEnv('COHERE_RERANK_MODEL');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, query, documents, top_n: topN }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Cohere rerank failed (${res.status}): ${detail}`);
    }

    const json = (await res.json()) as {
      results: Array<{ index: number; relevance_score: number }>;
    };
    return json.results.map((r) => ({ index: r.index, relevanceScore: r.relevance_score }));
  } finally {
    clearTimeout(timer);
  }
}
