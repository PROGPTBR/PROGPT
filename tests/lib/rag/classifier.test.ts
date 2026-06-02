import { describe, expect, it, beforeEach, vi } from 'vitest';

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

describe('rag classifier', () => {
  it('returns parsed classification on valid JSON', async () => {
    mockOpenAI({
      text: JSON.stringify({
        theory: 'kraljic',
        intent: 'definition',
        language: 'pt',
        needsRetrieval: true,
      }),
    });
    const { classify } = await import('@/lib/rag/classifier');
    const result = await classify('o que é a matriz de Kraljic?');
    expect(result).toEqual({
      theory: 'kraljic',
      intent: 'definition',
      language: 'pt',
      needsRetrieval: true,
    });
  });

  it('returns safe default when OpenAI throws', async () => {
    mockOpenAI({ throws: new Error('boom') });
    const { classify } = await import('@/lib/rag/classifier');
    const result = await classify('hello');
    expect(result).toEqual({
      theory: null,
      intent: 'definition',
      language: 'pt',
      needsRetrieval: true,
    });
  });

  it('returns safe default when JSON is malformed', async () => {
    mockOpenAI({ text: 'not json {' });
    const { classify } = await import('@/lib/rag/classifier');
    const result = await classify('hi');
    expect(result.intent).toBe('definition');
    expect(result.needsRetrieval).toBe(true);
    expect(result.theory).toBeNull();
  });

  it('returns safe default when intent enum is invalid', async () => {
    mockOpenAI({
      text: JSON.stringify({
        theory: null,
        intent: 'bogus',
        language: 'pt',
        needsRetrieval: true,
      }),
    });
    const { classify } = await import('@/lib/rag/classifier');
    const result = await classify('?');
    expect(result.intent).toBe('definition');
  });

  it('accepts smalltalk intent and propagates needsRetrieval=false', async () => {
    const { create } = mockOpenAI({
      text: JSON.stringify({
        theory: null,
        intent: 'smalltalk',
        language: 'pt',
        needsRetrieval: false,
      }),
    });
    const { classify } = await import('@/lib/rag/classifier');
    const result = await classify('oi');
    expect(result.intent).toBe('smalltalk');
    expect(result.needsRetrieval).toBe(false);
    // Verify json_object response_format was requested
    const callBody = create.mock.calls[0]?.[0] as { response_format?: { type: string } };
    expect(callBody.response_format).toEqual({ type: 'json_object' });
  });

  it('accepts supplier_search intent with needsRetrieval=false (sub-projeto 21)', async () => {
    mockOpenAI({
      text: JSON.stringify({
        theory: null,
        intent: 'supplier_search',
        language: 'pt',
        needsRetrieval: false,
      }),
    });
    const { classify } = await import('@/lib/rag/classifier');
    const result = await classify('preciso de fornecedores de embalagens flexíveis');
    expect(result.intent).toBe('supplier_search');
    expect(result.needsRetrieval).toBe(false);
  });

  it('system prompt teaches the model what supplier_search means (sub-projeto 21)', async () => {
    const { create } = mockOpenAI({
      text: JSON.stringify({
        theory: null,
        intent: 'smalltalk',
        language: 'pt',
        needsRetrieval: false,
      }),
    });
    const { classify } = await import('@/lib/rag/classifier');
    await classify('any query');
    const callBody = create.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const sys = callBody.messages.find((m) => m.role === 'system')?.content ?? '';
    expect(sys).toMatch(/supplier_search/);
    expect(sys).toMatch(/quem fabrica/i);
    expect(sys).toMatch(/AÇÃO/);
  });

  it('accepts library_overview intent with needsRetrieval=false (sub-projeto 18)', async () => {
    mockOpenAI({
      text: JSON.stringify({
        theory: null,
        intent: 'library_overview',
        language: 'pt',
        needsRetrieval: false,
      }),
    });
    const { classify } = await import('@/lib/rag/classifier');
    const result = await classify('que temas você cobre?');
    expect(result.intent).toBe('library_overview');
    expect(result.needsRetrieval).toBe(false);
  });

  it('system prompt teaches the model what library_overview means with examples', async () => {
    const { create } = mockOpenAI({
      text: JSON.stringify({
        theory: null,
        intent: 'smalltalk',
        language: 'pt',
        needsRetrieval: false,
      }),
    });
    const { classify } = await import('@/lib/rag/classifier');
    await classify('any query');
    const callBody = create.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const sys = callBody.messages.find((m) => m.role === 'system')?.content ?? '';
    expect(sys).toMatch(/library_overview/);
    expect(sys).toMatch(/que temas você cobre/i);
    expect(sys).toMatch(/META/);
  });

  it('calls the model with temperature 0 (deterministic routing — fixes intermittent smalltalk misroute)', async () => {
    const { create } = mockOpenAI({
      text: JSON.stringify({
        theory: null,
        intent: 'definition',
        language: 'pt',
        needsRetrieval: true,
      }),
    });
    const { classify } = await import('@/lib/rag/classifier');
    await classify('qual o impacto da reforma tributária na indústria química?');
    const callBody = create.mock.calls[0]?.[0] as { temperature?: number };
    expect(callBody.temperature).toBe(0);
  });

  it('accepts theory as null and intent as application', async () => {
    mockOpenAI({
      text: JSON.stringify({
        theory: null,
        intent: 'application',
        language: 'en',
        needsRetrieval: true,
      }),
    });
    const { classify } = await import('@/lib/rag/classifier');
    const result = await classify('how to apply Kraljic in food retail?');
    expect(result.intent).toBe('application');
    expect(result.language).toBe('en');
  });
});
