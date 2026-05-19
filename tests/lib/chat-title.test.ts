import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  vi.resetModules();
});

function mockOpenAIOnce(returns: { text?: string; throws?: Error }) {
  const create = vi.fn().mockImplementation(async () => {
    if (returns.throws) throw returns.throws;
    return {
      choices: [{ message: { content: returns.text ?? '' } }],
      usage: { prompt_tokens: 100, completion_tokens: 10 },
    };
  });
  vi.doMock('@/lib/llm/openai', () => ({
    getOpenAI: () => ({ chat: { completions: { create } } }),
    getOpenAIModel: () => 'gpt-4o-mini',
  }));
  vi.doMock('@/lib/observability/api-usage', () => ({
    recordApiUsage: vi.fn(),
  }));
  return { create };
}

describe('summarizeChatTitle', () => {
  it('returns the LLM output as the title on a clean response', async () => {
    mockOpenAIOnce({ text: 'Aplicar Kraljic em Embalagens' });
    const { summarizeChatTitle } = await import('@/lib/chat-title');
    const out = await summarizeChatTitle({
      userMessage: 'como aplicar kraljic em embalagens?',
      assistantSnippet: 'A matriz de Kraljic é uma ferramenta...',
    });
    expect(out).toBe('Aplicar Kraljic em Embalagens');
  });

  it('strips wrapping quotes and trailing periods', async () => {
    mockOpenAIOnce({ text: '"Estratégia de Sourcing para TI".' });
    const { summarizeChatTitle } = await import('@/lib/chat-title');
    const out = await summarizeChatTitle({
      userMessage: 'estratégia para TI',
      assistantSnippet: 'Para TI...',
    });
    expect(out).toBe('Estratégia de Sourcing para TI');
  });

  it('falls back to truncated user message when LLM throws', async () => {
    mockOpenAIOnce({ throws: new Error('boom') });
    const { summarizeChatTitle } = await import('@/lib/chat-title');
    const out = await summarizeChatTitle({
      userMessage: 'O que é a matriz de Kraljic?',
      assistantSnippet: '',
    });
    expect(out).toBe('O que é a matriz de Kraljic?');
  });

  it('falls back when LLM returns empty string', async () => {
    mockOpenAIOnce({ text: '   ' });
    const { summarizeChatTitle } = await import('@/lib/chat-title');
    const out = await summarizeChatTitle({
      userMessage: 'pergunta curta',
      assistantSnippet: 'resposta',
    });
    expect(out).toBe('pergunta curta');
  });

  it('truncates long titles to 60 chars with ellipsis', async () => {
    mockOpenAIOnce({
      text: 'Um Título Muito Longo Que Excede o Limite de Sessenta Caracteres Permitido',
    });
    const { summarizeChatTitle } = await import('@/lib/chat-title');
    const out = await summarizeChatTitle({
      userMessage: 'x',
      assistantSnippet: 'y',
    });
    expect(out).not.toBeNull();
    expect(out!.length).toBeLessThanOrEqual(61); // 60 + ellipsis
    expect(out!.endsWith('…')).toBe(true);
  });

  it('records api usage with chat-title-summarize operation', async () => {
    mockOpenAIOnce({ text: 'Boa Pergunta' });
    const usageMod = await import('@/lib/observability/api-usage');
    const spy = usageMod.recordApiUsage as ReturnType<typeof vi.fn>;
    const { summarizeChatTitle } = await import('@/lib/chat-title');
    await summarizeChatTitle({
      userMessage: 'oi',
      assistantSnippet: 'olá',
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        operation: 'chat-title-summarize',
        tokensIn: 100,
        tokensOut: 10,
      }),
    );
  });
});
