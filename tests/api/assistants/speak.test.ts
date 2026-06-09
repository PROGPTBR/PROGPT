import { describe, it, expect, beforeEach, vi } from 'vitest';

// Sub-projeto 34 — endpoint TTS do modo voz da negociação.

beforeEach(() => {
  vi.resetModules();
});

const VALID_SETUP = {
  personaProfile: 'agressivo',
  supplierObjectives: 'maximizar preço',
  supplierWalkaway: 'não vendo abaixo de 100',
};

function mockBase(opts: {
  user?: { id: string } | null;
  run?: Record<string, unknown> | null;
  rateLimited?: boolean;
}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi
      .fn()
      .mockResolvedValue('user' in opts ? opts.user : { id: 'u1' }),
  }));
  vi.doMock('@/lib/observability/user-context', () => ({
    withUser: (_id: string, fn: () => unknown) => fn(),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi.fn().mockResolvedValue(
      opts.rateLimited
        ? { allowed: false, retryAfterSecs: 30 }
        : { allowed: true },
    ),
  }));
  vi.doMock('@/lib/assistants/runs', () => ({
    getRunForOwner: vi.fn().mockResolvedValue(
      opts.run === null
        ? null
        : (opts.run ?? {
            id: 'run1',
            assistant_type: 'negotiation',
            params: { supplierName: 'X', category: 'Y', simulator: VALID_SETUP },
            strategy: null,
          }),
    ),
  }));
  vi.doMock('@/lib/observability/api-usage', () => ({
    recordApiUsage: vi.fn().mockResolvedValue(undefined),
  }));
  const speechCreate = vi.fn().mockResolvedValue({
    arrayBuffer: async () => new ArrayBuffer(16),
  });
  vi.doMock('@/lib/llm/openai', () => ({
    getOpenAI: () => ({ audio: { speech: { create: speechCreate } } }),
  }));
  return { speechCreate };
}

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/assistants/runs/run1/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/assistants/runs/[id]/speak', () => {
  it('401 sem usuário', async () => {
    mockBase({ user: null });
    const { POST } = await import('@/app/api/assistants/runs/[id]/speak/route');
    const res = await POST(makeReq({ text: 'olá' }), { params: { id: 'run1' } });
    expect(res.status).toBe(401);
  });

  it('429 quando rate-limited', async () => {
    mockBase({ rateLimited: true });
    const { POST } = await import('@/app/api/assistants/runs/[id]/speak/route');
    const res = await POST(makeReq({ text: 'olá' }), { params: { id: 'run1' } });
    expect(res.status).toBe(429);
  });

  it('400 com body inválido (texto vazio)', async () => {
    mockBase({});
    const { POST } = await import('@/app/api/assistants/runs/[id]/speak/route');
    const res = await POST(makeReq({ text: '' }), { params: { id: 'run1' } });
    expect(res.status).toBe(400);
  });

  it('404 quando a run não é do usuário ou não é negociação', async () => {
    mockBase({ run: null });
    const { POST } = await import('@/app/api/assistants/runs/[id]/speak/route');
    const res = await POST(makeReq({ text: 'olá' }), { params: { id: 'run1' } });
    expect(res.status).toBe(404);
  });

  it('200 audio/mpeg; voz vem da persona do RUN (server-side), não do body', async () => {
    const m = mockBase({});
    const { POST } = await import('@/app/api/assistants/runs/[id]/speak/route');
    const res = await POST(
      // body tenta forjar persona — deve ser ignorado (não está no schema)
      makeReq({ text: 'não aceito esse cenário de impostos', persona: 'colaborativo' }),
      { params: { id: 'run1' } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    const args = m.speechCreate.mock.calls[0]![0] as {
      model: string;
      voice: string;
      instructions: string;
    };
    expect(args.model).toBe('gpt-4o-mini-tts');
    // persona do run é 'agressivo' → instruções firmes, voz do mapa agressivo
    expect(args.instructions).toMatch(/firme|impaciente/i);
  });

  it('502 quando o TTS falha (não-fatal pro cliente)', async () => {
    const m = mockBase({});
    m.speechCreate.mockRejectedValueOnce(new Error('tts down'));
    const { POST } = await import('@/app/api/assistants/runs/[id]/speak/route');
    const res = await POST(makeReq({ text: 'olá' }), { params: { id: 'run1' } });
    expect(res.status).toBe(502);
  });
});
