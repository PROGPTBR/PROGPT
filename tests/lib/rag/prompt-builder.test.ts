import { describe, expect, it } from 'vitest';
import type { Classification, RetrievedChunk } from '@/lib/rag/types';

function chunk(id: string, content: string, title: string): RetrievedChunk {
  return {
    chunkId: id,
    articleId: `art-${id}`,
    content,
    ord: 0,
    articleTitle: title,
    vectorRank: null,
    ftsRank: null,
    rrfScore: 0,
    rerankScore: null,
  };
}

const ptClass: Classification = {
  theory: null,
  intent: 'definition',
  language: 'pt',
  needsRetrieval: true,
};
const enClass: Classification = { ...ptClass, language: 'en' };

describe('rag prompt-builder', () => {
  it('builds numbered citation tokens for each chunk', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt(
      'O que é Kraljic?',
      [
        chunk('c1', 'Kraljic propôs em 1983...', 'A Matriz de Kraljic'),
        chunk('c2', 'Aplica-se classificando itens...', 'A Matriz de Kraljic'),
      ],
      ptClass,
    );
    expect(result.user).toContain('[1]');
    expect(result.user).toContain('[2]');
    expect(result.user).toContain('A Matriz de Kraljic');
    expect(result.user).toContain('Kraljic propôs em 1983');
    expect(result.sources.map((s) => s.number)).toEqual([1, 2]);
    expect(result.sources[0]?.chunkId).toBe('c1');
    expect(result.sources[1]?.chunkId).toBe('c2');
  });

  it('includes refusal instruction when chunks are empty', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt('?', [], ptClass);
    expect(result.system.toLowerCase()).toContain('não tem fonte');
    expect(result.system.toLowerCase()).toContain('não invente');
    expect(result.sources).toEqual([]);
    expect(result.user).toContain('?'); // user query still in there
  });

  it('flips language hint to English when classification.language=en', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt('What is Kraljic?', [], enClass);
    expect(result.system).toMatch(/respond in english/i);
    expect(result.system).not.toMatch(/responda em português/i);
  });

  it('uses Portuguese hint by default', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt('?', [], ptClass);
    expect(result.system).toMatch(/responda em português/i);
  });

  it('aligns sources[i].number with the [N] tokens in the user prompt', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt(
      'q',
      [chunk('a', 'A', 'TitleA'), chunk('b', 'B', 'TitleB'), chunk('c', 'C', 'TitleC')],
      ptClass,
    );
    for (const src of result.sources) {
      expect(result.user).toContain(`[${src.number}]`);
    }
  });

  it('includes the persona and 4-part response structure in system prompt', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt('q', [chunk('a', 'A', 'T')], ptClass);
    expect(result.system).toMatch(/especialista/i);
    expect(result.system).toMatch(/procurement/i);
    // Mentions the 4-part structure markers
    expect(result.system).toMatch(/resposta direta/i);
    expect(result.system).toMatch(/aplicação prática/i);
  });
});
