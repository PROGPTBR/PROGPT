import { describe, expect, it } from 'vitest';

describe('lib/ingest/chunker', () => {
  it('joins short paragraphs into a single chunk', async () => {
    const { chunkText } = await import('@/lib/ingest/chunker');
    const out = chunkText('Primeira frase.\n\nSegunda frase.\n\nTerceira.');
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('Primeira');
    expect(out[0]).toContain('Terceira');
  });

  it('sliding-window splits a single paragraph that exceeds MAX_CHUNK_CHARS, with overlap', async () => {
    const { chunkText } = await import('@/lib/ingest/chunker');
    const long = 'a'.repeat(8000);
    const out = chunkText(long);
    expect(out.length).toBeGreaterThanOrEqual(3);
    // Adjacent chunks must share at least 200 chars of overlap.
    const tail = out[0]!.slice(-400);
    const head = out[1]!.slice(0, 400);
    let shared = 0;
    for (let i = 1; i <= 400; i++) {
      if (tail.slice(-i) === head.slice(0, i)) shared = i;
    }
    expect(shared).toBeGreaterThan(0);
    out.forEach((c) => expect(c.length).toBeLessThanOrEqual(3200));
  });

  it('returns empty array for empty or whitespace-only input', async () => {
    const { chunkText } = await import('@/lib/ingest/chunker');
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n   ')).toEqual([]);
  });
});
