import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  vi.resetModules();
});

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Regression guard for "modo pessoal nunca toca o pipeline RAG" — mode:
// 'personal' must dispatch to handlePersonalChatTurn and return BEFORE any
// RAG-specific code (rate-limit, condenser, runRag) executes.
describe('POST /api/chat — mode: personal dispatch', () => {
  it('delegates to handlePersonalChatTurn and returns its response, without touching the RAG pipeline', async () => {
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-123' }),
    }));
    const checkChatRateLimit = vi.fn();
    vi.doMock('@/lib/rate-limit', () => ({ checkChatRateLimit }));
    const condenseQuery = vi.fn();
    vi.doMock('@/lib/rag/condenser', () => ({ condenseQuery }));
    const runRag = vi.fn();
    vi.doMock('@/lib/rag', () => ({ runRag }));
    vi.doMock('ai', () => ({
      streamText: vi.fn(),
      StreamData: class {
        appendMessageAnnotation = vi.fn();
        close = vi.fn();
      },
    }));
    vi.doMock('@ai-sdk/openai', () => ({
      createOpenAI: vi.fn(() => () => 'mock-model'),
    }));

    const personalResponse = new Response('personal-body', { status: 200 });
    const handlePersonalChatTurn = vi.fn().mockResolvedValue(personalResponse);
    vi.doMock('@/lib/chat/personal-assistant', () => ({ handlePersonalChatTurn }));

    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      makeReq({
        messages: [{ role: 'user', content: 'qual foi o placar do jogo' }],
        sessionId: '11111111-1111-1111-1111-111111111111',
        mode: 'personal',
      }),
    );

    expect(res).toBe(personalResponse);
    expect(handlePersonalChatTurn).toHaveBeenCalledWith({
      userId: 'user-123',
      messages: [{ role: 'user', content: 'qual foi o placar do jogo' }],
      sessionId: '11111111-1111-1111-1111-111111111111',
    });
    expect(checkChatRateLimit).not.toHaveBeenCalled();
    expect(condenseQuery).not.toHaveBeenCalled();
    expect(runRag).not.toHaveBeenCalled();
  });

  it('still 401s an unauthenticated request before dispatching to personal mode', async () => {
    vi.doMock('@/lib/auth', () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));
    const handlePersonalChatTurn = vi.fn();
    vi.doMock('@/lib/chat/personal-assistant', () => ({ handlePersonalChatTurn }));
    vi.doMock('ai', () => ({
      streamText: vi.fn(),
      StreamData: class {
        appendMessageAnnotation = vi.fn();
        close = vi.fn();
      },
    }));
    vi.doMock('@ai-sdk/openai', () => ({
      createOpenAI: vi.fn(() => () => 'mock-model'),
    }));

    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      makeReq({ messages: [{ role: 'user', content: 'oi' }], mode: 'personal' }),
    );
    expect(res.status).toBe(401);
    expect(handlePersonalChatTurn).not.toHaveBeenCalled();
  });
});
