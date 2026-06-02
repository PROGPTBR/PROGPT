import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { ChatMessage } from '@/lib/rag/types';

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  vi.resetModules();
});

function mockOpenAI(returns: { text?: string; throws?: Error }) {
  const create = vi.fn().mockImplementation(async () => {
    if (returns.throws) throw returns.throws;
    return { choices: [{ message: { content: returns.text ?? '' } }] };
  });
  vi.doMock('@/lib/llm/openai', () => ({
    getOpenAI: () => ({ chat: { completions: { create } } }),
    getOpenAIModel: () => 'gpt-4o-mini',
  }));
  return { create };
}

describe('rag condenser', () => {
  it('returns content directly without calling OpenAI for single-turn', async () => {
    const createSpy = vi.fn();
    vi.doMock('@/lib/llm/openai', () => ({
      getOpenAI: () => ({
        chat: { completions: { create: createSpy } },
      }),
      getOpenAIModel: () => 'gpt-4o-mini',
    }));
    const { condenseQuery } = await import('@/lib/rag/condenser');
    const messages: ChatMessage[] = [{ role: 'user', content: '  hello world  ' }];
    const result = await condenseQuery(messages);
    expect(result).toBe('hello world');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('calls OpenAI and returns rewritten string for multi-turn', async () => {
    mockOpenAI({ text: 'Como aplicar a matriz de Kraljic?' });
    const { condenseQuery } = await import('@/lib/rag/condenser');
    const messages: ChatMessage[] = [
      { role: 'user', content: 'O que é a matriz de Kraljic?' },
      { role: 'assistant', content: 'É um framework de procurement...' },
      { role: 'user', content: 'E como aplicar?' },
    ];
    const result = await condenseQuery(messages);
    expect(result).toBe('Como aplicar a matriz de Kraljic?');
  });

  it('falls back to last user message when OpenAI throws', async () => {
    mockOpenAI({ throws: new Error('boom') });
    const { condenseQuery } = await import('@/lib/rag/condenser');
    const messages: ChatMessage[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'follow-up' },
    ];
    const result = await condenseQuery(messages);
    expect(result).toBe('follow-up');
  });

  it('falls back to last user message when OpenAI returns empty text', async () => {
    mockOpenAI({ text: '' });
    const { condenseQuery } = await import('@/lib/rag/condenser');
    const messages: ChatMessage[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ];
    const result = await condenseQuery(messages);
    expect(result).toBe('c');
  });

  it('calls OpenAI with temperature 0 (deterministic query rewrite)', async () => {
    const { create } = mockOpenAI({ text: 'pergunta autônoma' });
    const { condenseQuery } = await import('@/lib/rag/condenser');
    await condenseQuery([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ]);
    const callBody = create.mock.calls[0]?.[0] as { temperature?: number };
    expect(callBody.temperature).toBe(0);
  });

  it('strips wrapping quotes from the rewritten output', async () => {
    mockOpenAI({ text: '"o que é kraljic?"' });
    const { condenseQuery } = await import('@/lib/rag/condenser');
    const messages: ChatMessage[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ];
    const result = await condenseQuery(messages);
    expect(result).toBe('o que é kraljic?');
  });
});
