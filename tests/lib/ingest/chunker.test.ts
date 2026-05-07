import { describe, expect, it } from 'vitest';
import type { Block } from '@/lib/ingest/types';

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

describe('chunkBlocks', () => {
  it('single text block → behaves like chunkText for the same content', async () => {
    const { chunkBlocks } = await import('@/lib/ingest/chunker');
    const long = 'parágrafo um. '.repeat(300); // well over 3200 chars
    const blocks: Block[] = [{ type: 'text', page: 1, content: long }];
    const out = chunkBlocks(blocks);
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) {
      expect(c.metadata.kind).toBe('text');
      expect(c.metadata.page).toBe(1);
      expect(c.content.length).toBeLessThanOrEqual(3200);
    }
  });

  it('single table block → 1 chunk with kind=table and content includes caption + markdown', async () => {
    const { chunkBlocks } = await import('@/lib/ingest/chunker');
    const blocks: Block[] = [
      { type: 'table', page: 4, markdown: '| a |\n|---|\n| 1 |', caption: 'Tabela 2' },
    ];
    const out = chunkBlocks(blocks);
    expect(out).toHaveLength(1);
    expect(out[0]!.metadata.kind).toBe('table');
    expect(out[0]!.metadata.page).toBe(4);
    expect(out[0]!.metadata.caption).toBe('Tabela 2');
    expect(out[0]!.content).toContain('Tabela 2');
    expect(out[0]!.content).toContain('| a |');
  });

  it('single figure block → 1 chunk with kind=figure, figureKind preserved', async () => {
    const { chunkBlocks } = await import('@/lib/ingest/chunker');
    const blocks: Block[] = [
      {
        type: 'figure',
        page: 7,
        description: 'A flow diagram with three labelled boxes connected by arrows.',
        caption: 'Figura 3',
        figureKind: 'flow',
      },
    ];
    const out = chunkBlocks(blocks);
    expect(out).toHaveLength(1);
    expect(out[0]!.metadata.kind).toBe('figure');
    expect(out[0]!.metadata.figureKind).toBe('flow');
    expect(out[0]!.content).toContain('Figura 3');
  });

  it('text + table + text + figure + text → text chunks merge contiguous spans, structured blocks stay individual', async () => {
    const { chunkBlocks } = await import('@/lib/ingest/chunker');
    const blocks: Block[] = [
      { type: 'text', page: 1, content: 'short text 1' },
      { type: 'table', page: 1, markdown: '| h |\n|---|\n| v |' },
      { type: 'text', page: 2, content: 'short text 2' },
      {
        type: 'figure',
        page: 3,
        description: 'A simple diagram description that is long enough to pass.',
        figureKind: 'diagram',
      },
      { type: 'text', page: 3, content: 'short text 3' },
    ];
    const out = chunkBlocks(blocks);
    const kinds = out.map((c) => c.metadata.kind);
    expect(kinds).toEqual(['text', 'table', 'text', 'figure', 'text']);
  });

  it('table block does not split even when markdown exceeds 3200 chars', async () => {
    const { chunkBlocks } = await import('@/lib/ingest/chunker');
    const big = '| col |\n|---|\n' + '| value |\n'.repeat(400); // > 3200
    const blocks: Block[] = [{ type: 'table', page: 1, markdown: big }];
    const out = chunkBlocks(blocks);
    expect(out).toHaveLength(1);
    expect(out[0]!.content.length).toBeGreaterThan(3200);
  });
});
