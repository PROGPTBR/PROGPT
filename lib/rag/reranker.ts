import { rerank as cohereRerank } from '@/lib/llm/cohere';
import type { RetrievedChunk } from './types';

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
    return hits
      .map((h) => {
        const src = chunks[h.index];
        if (!src) return null;
        return { ...src, rerankScore: h.relevanceScore };
      })
      .filter((c): c is RetrievedChunk => c !== null);
  } catch (err) {
    console.warn('[rag/reranker] Cohere failed, falling back to RRF order:', err);
    return chunks.slice(0, topN);
  }
}
