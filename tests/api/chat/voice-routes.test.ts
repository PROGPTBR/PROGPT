import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Sub-projeto 35 — rotas do assistente de voz realtime (early-returns + shape;
// sem WebRTC real). Padrão de mocks do negotiate/speak.

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function mockAuth(user: { id: string } | null) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue(user),
  }));
  vi.doMock('@/lib/observability/user-context', () => ({
    withUser: (_id: string, fn: () => unknown) => fn(),
    currentUserId: () => null,
  }));
}

function mockRateLimit(allowed: boolean) {
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi
      .fn()
      .mockResolvedValue(allowed ? { allowed: true } : { allowed: false, retryAfterSecs: 42 }),
  }));
}

function mockLangfuse() {
  vi.doMock('@/lib/observability/langfuse', () => ({
    startTrace: vi.fn().mockResolvedValue({
      id: 'mock-trace-id',
      span: () => ({ end: () => {} }),
      end: () => {},
    }),
    flushAsync: vi.fn().mockResolvedValue(undefined),
  }));
}

// ── /api/chat/voice/session ──────────────────────────────────────────────────

describe('POST /api/chat/voice/session', () => {
  it('401 sem usuário', async () => {
    mockAuth(null);
    mockRateLimit(true);
    const { POST } = await import('@/app/api/chat/voice/session/route');
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('429 quando rate-limited (mint conta no bucket do chat)', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(false);
    const { POST } = await import('@/app/api/chat/voice/session/route');
    const res = await POST();
    expect(res.status).toBe(429);
  });

  it('200 com clientSecret/model/maxSecs; manda Safety-Identifier pseudonimizado', async () => {
    mockAuth({ id: 'uuid-do-user' });
    mockRateLimit(true);
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ value: 'ek_abc', expires_at: 123 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const { POST } = await import('@/app/api/chat/voice/session/route');
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.clientSecret).toBe('ek_abc');
    expect(body.model).toBe('gpt-realtime-mini');
    expect(body.maxSecs).toBe(600);
    const [url, init] = fetchSpy.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain('/v1/realtime/client_secrets');
    expect((init.headers as Record<string, string>)['OpenAI-Safety-Identifier']).toBe(
      'uuid-do-user',
    );
  });

  it('502 quando o mint da OpenAI falha', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('nope', { status: 500 })),
    );
    const { POST } = await import('@/app/api/chat/voice/session/route');
    const res = await POST();
    expect(res.status).toBe(502);
  });
});

// ── /api/chat/voice/retrieve ─────────────────────────────────────────────────

function retrieveReq(body: unknown) {
  return new Request('http://localhost/api/chat/voice/retrieve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat/voice/retrieve', () => {
  it('401 sem usuário', async () => {
    mockAuth(null);
    mockRateLimit(true);
    mockLangfuse();
    const { POST } = await import('@/app/api/chat/voice/retrieve/route');
    const res = await POST(retrieveReq({ query: 'kraljic' }));
    expect(res.status).toBe(401);
  });

  it('400 com query curta demais', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockLangfuse();
    const { POST } = await import('@/app/api/chat/voice/retrieve/route');
    const res = await POST(retrieveReq({ query: 'ab' }));
    expect(res.status).toBe(400);
  });

  it('200 com contexto concatenado dos chunks rerankeados', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockLangfuse();
    vi.doMock('@/lib/rag/retriever', () => ({
      retrieve: vi.fn().mockResolvedValue([{ chunkId: 'c1' }, { chunkId: 'c2' }]),
    }));
    vi.doMock('@/lib/rag/reranker', () => ({
      rerank: vi.fn().mockResolvedValue([
        { articleTitle: 'Matriz de Kraljic', content: 'Os 4 quadrantes...' },
        { articleTitle: 'Strategic Sourcing', content: 'As 7 etapas...' },
      ]),
    }));
    const { POST } = await import('@/app/api/chat/voice/retrieve/route');
    const res = await POST(retrieveReq({ query: 'matriz de kraljic' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { context: string };
    expect(body.context).toContain('### Matriz de Kraljic');
    expect(body.context).toContain('Os 4 quadrantes...');
    expect(body.context).toContain('### Strategic Sourcing');
  });

  it('200 com contexto vazio quando o rerank filtra tudo (sem fonte)', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockLangfuse();
    vi.doMock('@/lib/rag/retriever', () => ({
      retrieve: vi.fn().mockResolvedValue([{ chunkId: 'c1' }]),
    }));
    vi.doMock('@/lib/rag/reranker', () => ({
      rerank: vi.fn().mockResolvedValue([]),
    }));
    const { POST } = await import('@/app/api/chat/voice/retrieve/route');
    const res = await POST(retrieveReq({ query: 'tema fora da base' }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { context: string }).context).toBe('');
  });

  it('fail-soft: retrieval explode → 200 com contexto vazio (não derruba a conversa)', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockLangfuse();
    vi.doMock('@/lib/rag/retriever', () => ({
      retrieve: vi.fn().mockRejectedValue(new Error('voyage down')),
    }));
    vi.doMock('@/lib/rag/reranker', () => ({ rerank: vi.fn() }));
    const { POST } = await import('@/app/api/chat/voice/retrieve/route');
    const res = await POST(retrieveReq({ query: 'matriz de kraljic' }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { context: string }).context).toBe('');
  });
});

// ── /api/chat/voice/usage ────────────────────────────────────────────────────

function usageReq(body: unknown) {
  return new Request('http://localhost/api/chat/voice/usage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat/voice/usage', () => {
  it('401 sem usuário', async () => {
    mockAuth(null);
    const { POST } = await import('@/app/api/chat/voice/usage/route');
    const res = await POST(usageReq({ audioIn: 100 }));
    expect(res.status).toBe(401);
  });

  it('400 com valores negativos', async () => {
    mockAuth({ id: 'u1' });
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage: vi.fn() }));
    const { POST } = await import('@/app/api/chat/voice/usage/route');
    const res = await POST(usageReq({ audioIn: -5 }));
    expect(res.status).toBe(400);
  });

  it('grava usage com split por modalidade no metadata', async () => {
    mockAuth({ id: 'u1' });
    const record = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage: record }));
    const { POST } = await import('@/app/api/chat/voice/usage/route');
    const res = await POST(
      usageReq({ audioIn: 6000, audioOut: 3000, textIn: 1000, textOut: 200, durationSecs: 300 }),
    );
    expect(res.status).toBe(200);
    const arg = record.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.operation).toBe('chat-voice-realtime');
    expect(arg.model).toBe('gpt-realtime-mini');
    expect(arg.tokensIn).toBe(7000);
    expect(arg.tokensOut).toBe(3200);
    expect((arg.metadata as Record<string, unknown>).audio_in).toBe(6000);
    expect((arg.metadata as Record<string, unknown>).client_reported).toBe(true);
  });

  it('skip silencioso quando tudo é zero (sessão sem fala)', async () => {
    mockAuth({ id: 'u1' });
    const record = vi.fn();
    vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage: record }));
    const { POST } = await import('@/app/api/chat/voice/usage/route');
    const res = await POST(usageReq({}));
    expect(res.status).toBe(200);
    expect(record).not.toHaveBeenCalled();
  });
});
