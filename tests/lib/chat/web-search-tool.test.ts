import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  process.env.OPENAI_API_KEY = 'test-key';
});

function mockOpenAI(create: ReturnType<typeof vi.fn>) {
  vi.doMock('@/lib/llm/openai', () => ({
    getOpenAI: () => ({ responses: { create } }),
    getOpenAIModel: () => 'gpt-routing-mock',
  }));
}

describe('createWebSearchTool', () => {
  it('date-anchors the query sent to responses.create (real bug 2026-09-03: stale search result with no recency signal)', async () => {
    const create = vi.fn().mockResolvedValue({ output_text: 'ok', usage: {} });
    mockOpenAI(create);
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage: vi.fn() }));

    const { createWebSearchTool } = await import('@/lib/chat/web-search-tool');
    const t = createWebSearchTool({ usedRef: { current: false }, operation: 'chat-tool-websearch' });
    await t.execute!({ query: 'placar do jogo do vasco' }, { toolCallId: 'x', messages: [] });

    const isoToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const createArg = create.mock.calls[0]![0] as { input: string };
    expect(createArg.input).toContain(isoToday);
    expect(createArg.input).toContain('placar do jogo do vasco');
    expect(createArg.input.indexOf(isoToday)).toBeLessThan(createArg.input.indexOf('placar do jogo do vasco'));
  });

  it('calls the search and records usage with the CALLER-SUPPLIED operation label', async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: 'Time X venceu por 3 a 0.',
      usage: { input_tokens: 12, output_tokens: 8 },
    });
    mockOpenAI(create);
    const recordApiUsage = vi.fn();
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage }));

    const { createWebSearchTool } = await import('@/lib/chat/web-search-tool');
    const usedRef = { current: false };
    const t = createWebSearchTool({ sessionId: 'sess-1', usedRef, operation: 'chat-tool-websearch' });

    const result = await t.execute!({ query: 'placar do jogo' }, { toolCallId: 'x', messages: [] });
    expect(result).toContain('3 a 0');
    expect(usedRef.current).toBe(true);
    expect(recordApiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'chat-tool-websearch', tokensIn: 12, tokensOut: 8 }),
    );

    const createArg = create.mock.calls[0]![0] as { tools: Array<{ type: string }> };
    expect(createArg.tools[0]!.type).toBe('web_search');
  });

  it('uses a different operation label per caller (Assistente Pessoal keeps its own)', async () => {
    const create = vi.fn().mockResolvedValue({ output_text: 'ok', usage: {} });
    mockOpenAI(create);
    const recordApiUsage = vi.fn();
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage }));

    const { createWebSearchTool } = await import('@/lib/chat/web-search-tool');
    const t = createWebSearchTool({
      usedRef: { current: false },
      operation: 'chat-personal-websearch',
    });
    await t.execute!({ query: 'x' }, { toolCallId: 'x', messages: [] });
    expect(recordApiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'chat-personal-websearch' }),
    );
  });

  it('never throws on API failure — returns a fail-soft string instead', async () => {
    const create = vi.fn().mockRejectedValue(new Error('down'));
    mockOpenAI(create);
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage: vi.fn() }));

    const { createWebSearchTool } = await import('@/lib/chat/web-search-tool');
    const t = createWebSearchTool({ usedRef: { current: false }, operation: 'chat-tool-websearch' });
    await expect(
      t.execute!({ query: 'x' }, { toolCallId: 'x', messages: [] }),
    ).resolves.toContain('down');
  });
});
