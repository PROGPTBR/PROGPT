import { describe, expect, it, beforeEach, vi } from 'vitest';

const NOOP_SPAN = { end: vi.fn() };
const NOOP_TRACE = {
  id: 'mock-trace-id',
  span: vi.fn(() => NOOP_SPAN),
  end: vi.fn(),
  setMetadata: vi.fn(),
  setTag: vi.fn(),
};

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  vi.resetModules();
  vi.useRealTimers();
});

function mockOpenAIOnce(returns: { text?: string; throws?: Error }) {
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

const PT_CLASSIFICATION = {
  theory: 'kraljic',
  intent: 'definition' as const,
  language: 'pt' as const,
  needsRetrieval: true,
};

const SAMPLE_CHUNK = {
  chunkId: 'c1',
  articleId: 'a1',
  content: 'A matriz de Kraljic divide o portfolio em quatro quadrantes...',
  ord: 0,
  articleTitle: 'A Matriz de Kraljic',
  vectorRank: 1,
  ftsRank: 2,
  rrfScore: 0.5,
  rerankScore: 0.8,
};

describe('rag followups', () => {
  it('returns 3 deepen suggestions when chunks are present (PT)', async () => {
    const { create } = mockOpenAIOnce({
      text: JSON.stringify({
        followups: [
          'Como aplicar Kraljic em PMEs?',
          'Diferenca entre Kraljic e Cox?',
          'Quais limitacoes da matriz?',
        ],
      }),
    });
    const { suggestFollowups } = await import('@/lib/rag/followups');
    const out = await suggestFollowups({
      query: 'O que e a matriz de Kraljic?',
      answer: 'E um framework de Peter Kraljic publicado em 1983...',
      chunks: [SAMPLE_CHUNK],
      classification: PT_CLASSIFICATION,
      parentTrace: NOOP_TRACE,
    });
    expect(out).toEqual([
      'Como aplicar Kraljic em PMEs?',
      'Diferenca entre Kraljic e Cox?',
      'Quais limitacoes da matriz?',
    ]);
    expect(create).toHaveBeenCalledOnce();
    const callBody = create.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
      response_format: { type: string };
    };
    // user message should contain the material available label and chunk title
    const userContent = callBody.messages[1]?.content ?? '';
    expect(userContent).toContain('Material disponivel');
    expect(userContent).toContain('A Matriz de Kraljic');
    expect(callBody.response_format).toEqual({ type: 'json_object' });
  });

  it('returns 3 redirect suggestions when chunks is empty (PT)', async () => {
    const { create } = mockOpenAIOnce({
      text: JSON.stringify({
        followups: [
          'Quer ver matriz de Kraljic?',
          'Modelos de TCO te interessam?',
          'Posso explicar SRM (Cousins)?',
        ],
      }),
    });
    const { suggestFollowups } = await import('@/lib/rag/followups');
    const out = await suggestFollowups({
      query: 'O que e blockchain?',
      answer: 'Nao tenho fonte na base sobre isso.',
      chunks: [],
      classification: PT_CLASSIFICATION,
      parentTrace: NOOP_TRACE,
    });
    expect(out).toHaveLength(3);
    const callBody = create.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    // "reformulacoes" is in the SYSTEM prompt for the redirect mode
    const systemContent = callBody.messages[0]?.content ?? '';
    expect(systemContent).toContain('reformulacoes');
    // user block should NOT contain the material label (deepen-only)
    const userContent = callBody.messages[1]?.content ?? '';
    expect(userContent).not.toContain('Material disponivel');
  });

  it('uses EN system prompt when classification.language is en', async () => {
    const { create } = mockOpenAIOnce({
      text: JSON.stringify({
        followups: [
          'How does Kraljic differ from Cox?',
          'How to apply it in food retail?',
          'What are the matrix limitations?',
        ],
      }),
    });
    const { suggestFollowups } = await import('@/lib/rag/followups');
    await suggestFollowups({
      query: 'What is the Kraljic matrix?',
      answer: 'It is a framework by Peter Kraljic from 1983...',
      chunks: [SAMPLE_CHUNK],
      classification: { ...PT_CLASSIFICATION, language: 'en' },
      parentTrace: NOOP_TRACE,
    });
    const callBody = create.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemContent = callBody.messages[0]?.content ?? '';
    expect(systemContent).toMatch(/follow-up/i);
    // EN user block uses "## Original question" not "Pergunta original"
    const userContent = callBody.messages[1]?.content ?? '';
    expect(userContent).toContain('## Original question');
    expect(userContent).not.toContain('Pergunta original');
  });

  it('returns [] when OpenAI throws', async () => {
    mockOpenAIOnce({ throws: new Error('boom') });
    const { suggestFollowups } = await import('@/lib/rag/followups');
    const out = await suggestFollowups({
      query: 'q',
      answer: 'a',
      chunks: [SAMPLE_CHUNK],
      classification: PT_CLASSIFICATION,
      parentTrace: NOOP_TRACE,
    });
    expect(out).toEqual([]);
  });

  it('returns [] when JSON is malformed', async () => {
    mockOpenAIOnce({ text: 'not json {' });
    const { suggestFollowups } = await import('@/lib/rag/followups');
    const out = await suggestFollowups({
      query: 'q',
      answer: 'a',
      chunks: [SAMPLE_CHUNK],
      classification: PT_CLASSIFICATION,
      parentTrace: NOOP_TRACE,
    });
    expect(out).toEqual([]);
  });

  it('returns [] when schema rejects (item too long)', async () => {
    mockOpenAIOnce({
      text: JSON.stringify({
        followups: ['ok', 'x'.repeat(200), 'fine'],
      }),
    });
    const { suggestFollowups } = await import('@/lib/rag/followups');
    const out = await suggestFollowups({
      query: 'q',
      answer: 'a',
      chunks: [SAMPLE_CHUNK],
      classification: PT_CLASSIFICATION,
      parentTrace: NOOP_TRACE,
    });
    expect(out).toEqual([]);
  });

  it('dedupes case-insensitively and removes echo of original query', async () => {
    mockOpenAIOnce({
      text: JSON.stringify({
        followups: [
          'O que e a matriz de Kraljic?',
          'Como aplicar Kraljic em PMEs?',
          'COMO APLICAR KRALJIC EM PMES?',
        ],
      }),
    });
    const { suggestFollowups } = await import('@/lib/rag/followups');
    const out = await suggestFollowups({
      query: 'O que e a matriz de Kraljic?',
      answer: 'E um framework...',
      chunks: [SAMPLE_CHUNK],
      classification: PT_CLASSIFICATION,
      parentTrace: NOOP_TRACE,
    });
    expect(out).toEqual(['Como aplicar Kraljic em PMEs?']);
  });

  it('aborts after 3s and returns []', async () => {
    vi.useFakeTimers();
    let abortReceived = false;
    const create = vi
      .fn()
      .mockImplementation(async (_body: unknown, options?: { signal?: AbortSignal }) => {
        const signal = options?.signal;
        return new Promise((_, reject) => {
          signal?.addEventListener('abort', () => {
            abortReceived = true;
            reject(new Error('aborted'));
          });
        });
      });
    vi.doMock('@/lib/llm/openai', () => ({
      getOpenAI: () => ({ chat: { completions: { create } } }),
      getOpenAIModel: () => 'gpt-4o-mini',
    }));
    const { suggestFollowups } = await import('@/lib/rag/followups');
    const promise = suggestFollowups({
      query: 'q',
      answer: 'a',
      chunks: [SAMPLE_CHUNK],
      classification: PT_CLASSIFICATION,
      parentTrace: NOOP_TRACE,
    });
    await vi.advanceTimersByTimeAsync(3100);
    const out = await promise;
    expect(out).toEqual([]);
    expect(abortReceived).toBe(true);
  });

  it('opens a parentTrace.span("suggest-followups") and ends it on success', async () => {
    mockOpenAIOnce({
      text: JSON.stringify({ followups: ['aa?', 'bb?', 'cc?'] }),
    });
    const spanEnd = vi.fn();
    const trace = {
      id: 't1',
      span: vi.fn(() => ({ end: spanEnd })),
      end: vi.fn(),
      setMetadata: vi.fn(),
      setTag: vi.fn(),
    };
    const { suggestFollowups } = await import('@/lib/rag/followups');
    const out = await suggestFollowups({
      query: 'q',
      answer: 'a',
      chunks: [SAMPLE_CHUNK],
      classification: PT_CLASSIFICATION,
      parentTrace: trace,
    });
    expect(out).toEqual(['aa?', 'bb?', 'cc?']);
    expect(trace.span).toHaveBeenCalledWith(
      'suggest-followups',
      expect.objectContaining({ mode: 'deepen', chunkCount: 1 }),
    );
    expect(spanEnd).toHaveBeenCalledOnce();
    const endArg = spanEnd.mock.calls[0]?.[0] as { count: number; latencyMs: number };
    expect(endArg).toMatchObject({ count: 3 });
    expect(typeof endArg.latencyMs).toBe('number');
  });

  it('ends span with WARNING level on failure', async () => {
    mockOpenAIOnce({ throws: new Error('boom') });
    const spanEnd = vi.fn();
    const trace = {
      id: 't1',
      span: vi.fn(() => ({ end: spanEnd })),
      end: vi.fn(),
      setMetadata: vi.fn(),
      setTag: vi.fn(),
    };
    const { suggestFollowups } = await import('@/lib/rag/followups');
    await suggestFollowups({
      query: 'q',
      answer: 'a',
      chunks: [SAMPLE_CHUNK],
      classification: PT_CLASSIFICATION,
      parentTrace: trace,
    });
    expect(spanEnd).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
      'WARNING',
    );
  });
});
