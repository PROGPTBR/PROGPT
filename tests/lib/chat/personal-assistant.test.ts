import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const NOOP_TRACE = {
  id: 'mock-trace-id',
  span: vi.fn(),
  end: vi.fn(),
  setMetadata: vi.fn(),
  setTag: vi.fn(),
};

beforeEach(() => {
  vi.resetModules();
  process.env.OPENAI_API_KEY = 'test-key';
});
afterEach(() => vi.unstubAllEnvs());

function mockCommon(opts: { create?: ReturnType<typeof vi.fn> } = {}) {
  const create = opts.create ?? vi.fn();
  vi.doMock('@/lib/llm/openai', () => ({
    getOpenAI: () => ({ responses: { create } }),
    getOpenAIModel: (tier?: string) => (tier === 'generation' ? 'gpt-generation-mock' : 'gpt-routing-mock'),
    getStreamingOpenAI: () => () => 'mock-streaming-model',
  }));
  vi.doMock('@/lib/observability/langfuse', () => ({
    startTrace: vi.fn().mockResolvedValue(NOOP_TRACE),
    flushAsync: vi.fn().mockResolvedValue(undefined),
  }));
  return { create };
}

function mockRateLimit(allowed: boolean, retryAfterSecs = 0) {
  vi.doMock('@/lib/rate-limit', () => ({
    checkPersonalChatRateLimit: vi.fn().mockResolvedValue(
      allowed ? { allowed: true } : { allowed: false, retryAfterSecs },
    ),
  }));
}

function mockAi(streamTextSpy: ReturnType<typeof vi.fn>) {
  vi.doMock('ai', () => ({
    streamText: streamTextSpy,
    StreamData: class {
      appendMessageAnnotation = vi.fn();
      close = vi.fn();
    },
    // Identity passthrough — lets tests grab `tools.web_search.execute`
    // straight off the args streamText was called with.
    tool: (config: unknown) => config,
  }));
}

describe('handlePersonalChatTurn', () => {
  it('returns 404 without calling streamText when PERSONAL_CHAT_ENABLED=false', async () => {
    vi.stubEnv('PERSONAL_CHAT_ENABLED', 'false');
    mockRateLimit(true);
    mockCommon();
    const recordApiUsage = vi.fn();
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage }));
    const streamTextSpy = vi.fn();
    mockAi(streamTextSpy);

    const { handlePersonalChatTurn } = await import('@/lib/chat/personal-assistant');
    const res = await handlePersonalChatTurn({
      userId: 'u1',
      messages: [{ role: 'user', content: 'e aí' }],
    });
    expect(res.status).toBe(404);
    expect(streamTextSpy).not.toHaveBeenCalled();
  });

  it('returns 429 with Retry-After when rate-limited, without calling streamText', async () => {
    mockRateLimit(false, 45);
    mockCommon();
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage: vi.fn() }));
    const streamTextSpy = vi.fn();
    mockAi(streamTextSpy);

    const { handlePersonalChatTurn } = await import('@/lib/chat/personal-assistant');
    const res = await handlePersonalChatTurn({
      userId: 'u1',
      messages: [{ role: 'user', content: 'e aí' }],
    });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('45');
    expect(streamTextSpy).not.toHaveBeenCalled();
  });

  it('omits the web_search tool when PERSONAL_CHAT_WEBSEARCH=false', async () => {
    vi.stubEnv('PERSONAL_CHAT_WEBSEARCH', 'false');
    mockRateLimit(true);
    mockCommon();
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage: vi.fn() }));
    const streamTextSpy = vi.fn().mockReturnValue({
      toDataStreamResponse: vi.fn(() => new Response('ok')),
    });
    mockAi(streamTextSpy);

    const { handlePersonalChatTurn } = await import('@/lib/chat/personal-assistant');
    await handlePersonalChatTurn({ userId: 'u1', messages: [{ role: 'user', content: 'oi' }] });

    const args = streamTextSpy.mock.calls[0]![0];
    expect(args.tools).toBeUndefined();
    expect(args.maxSteps).toBe(1);
  });

  it('includes the web_search tool by default, whose execute() records usage and returns the search text', async () => {
    mockRateLimit(true);
    const create = vi.fn().mockResolvedValue({
      output_text: 'Time X venceu por 2 a 1.',
      usage: { input_tokens: 50, output_tokens: 20 },
    });
    mockCommon({ create });
    const recordApiUsage = vi.fn();
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage }));
    const streamTextSpy = vi.fn().mockReturnValue({
      toDataStreamResponse: vi.fn(() => new Response('ok')),
    });
    mockAi(streamTextSpy);

    const { handlePersonalChatTurn } = await import('@/lib/chat/personal-assistant');
    await handlePersonalChatTurn({
      userId: 'u1',
      sessionId: 'sess-1',
      messages: [{ role: 'user', content: 'qual foi o placar' }],
    });

    const args = streamTextSpy.mock.calls[0]![0];
    expect(args.tools.web_search).toBeDefined();
    expect(args.maxSteps).toBe(4);

    const result = await args.tools.web_search.execute({ query: 'placar do jogo' });
    expect(result).toContain('2 a 1');
    expect(create).toHaveBeenCalledTimes(1);
    const createArg = create.mock.calls[0]![0] as { tools: Array<{ type: string }> };
    expect(createArg.tools[0]!.type).toBe('web_search');
    expect(recordApiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'chat-personal-websearch',
        tokensIn: 50,
        tokensOut: 20,
        metadata: expect.objectContaining({ web_search: true, session_id: 'sess-1' }),
      }),
    );
  });

  it('web_search execute() never throws on API failure — returns a fail-soft string', async () => {
    mockRateLimit(true);
    const create = vi.fn().mockRejectedValue(new Error('busca fora do ar'));
    mockCommon({ create });
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage: vi.fn() }));
    const streamTextSpy = vi.fn().mockReturnValue({
      toDataStreamResponse: vi.fn(() => new Response('ok')),
    });
    mockAi(streamTextSpy);

    const { handlePersonalChatTurn } = await import('@/lib/chat/personal-assistant');
    await handlePersonalChatTurn({ userId: 'u1', messages: [{ role: 'user', content: 'oi' }] });

    const args = streamTextSpy.mock.calls[0]![0];
    await expect(
      args.tools.web_search.execute({ query: 'algo' }),
    ).resolves.toContain('busca fora do ar');
  });

  it('onFinish tags the trace and records chat-personal-generate with the right token usage', async () => {
    mockRateLimit(true);
    mockCommon();
    const recordApiUsage = vi.fn();
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage }));
    const streamTextSpy = vi.fn().mockReturnValue({
      toDataStreamResponse: vi.fn(() => new Response('ok')),
    });
    mockAi(streamTextSpy);

    const { handlePersonalChatTurn } = await import('@/lib/chat/personal-assistant');
    await handlePersonalChatTurn({
      userId: 'u1',
      sessionId: 'sess-1',
      messages: [{ role: 'user', content: 'oi' }],
    });

    const args = streamTextSpy.mock.calls[0]![0];
    await args.onFinish({
      text: 'Oi! Como posso ajudar?',
      usage: { promptTokens: 10, completionTokens: 5 },
      finishReason: 'stop',
    });

    expect(recordApiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'chat-personal-generate',
        tokensIn: 10,
        tokensOut: 5,
      }),
    );
    expect(NOOP_TRACE.setTag).toHaveBeenCalledWith('websearch:unused');
    expect(NOOP_TRACE.end).toHaveBeenCalledWith(
      expect.objectContaining({ answer: 'Oi! Como posso ajudar?' }),
      'DEFAULT',
    );
  });
});
