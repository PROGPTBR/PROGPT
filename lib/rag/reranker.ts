import { rerank as cohereRerank } from '@/lib/llm/cohere';
import type { RetrievedChunk } from './types';

/**
 * Cohere v3 relevance scores below this are treated as noise: we drop the
 * chunk and let prompt-builder fall through to its REFUSAL_INSTRUCTION path.
 * Tuned empirically; gated by `npm run rag:eval` recall@5 >= 0.85.
 */
const MIN_RELEVANCE = 0.10;

export async function rerank(
  query: string,
  chunks: RetrievedChunk[],
  topN: number,
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];
  try {
    const hits = await cohereRerank(
      query,
      chunks.map((c) => c.content),
      topN,
    );
    const results: RetrievedChunk[] = [];
    for (const h of hits) {
      if (h.relevanceScore < MIN_RELEVANCE) continue;
      const src = chunks[h.index];
      if (src) results.push({ ...src, rerankScore: h.relevanceScore });
    }
    return results;
  } catch (err) {
    console.warn('[rag/reranker] Cohere failed, falling back to RRF order:', err);
    return chunks.slice(0, topN);
  }
}
