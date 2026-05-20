import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { ProfileParams } from '@/lib/assistants/types';

// Sub-projeto 34 — Perfil da Categoria ativo no chat.

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
});

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function sampleProfileParams(): ProfileParams {
  return {
    nomeCategoria: 'Embalagens flexíveis',
    descricao: 'Filmes e laminados.',
    subSegmentos: ['filmes laminados'],
    escopoIncluido: 'Filmes.',
    escopoNaoIncluido: '',
    requisitosTecnicos: 'ABNT NBR 14937.',
    restricoesRegulatorias: '',
    criteriosAvaliacao: ['Qualidade'],
    stakeholders: [{ nome: 'Maria', papel: 'aprovador' }],
    prioridadeEstrategica: 'qualidade',
    observacoes: '',
    volumeFisico: '',
    sazonalidade: '',
  };
}

function commonMocks(opts: {
  runRagSpy: ReturnType<typeof vi.fn>;
  getRunForOwnerImpl?: ReturnType<typeof vi.fn>;
  sessionUpdateSpy?: ReturnType<typeof vi.fn>;
}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-123' }),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  }));
  vi.doMock('@/lib/observability/langfuse', () => ({
    startTrace: vi.fn().mockResolvedValue(NOOP_TRACE),
    flushAsync: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('@/lib/rag/condenser', () => ({
    condenseQuery: vi.fn().mockResolvedValue('standalone'),
  }));
  vi.doMock('@/lib/rag', () => ({ runRag: opts.runRagSpy }));
  vi.doMock('@/lib/assistants/runs', () => ({
    getRunForOwner:
      opts.getRunForOwnerImpl ?? vi.fn().mockResolvedValue(null),
  }));
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({
        update: opts.sessionUpdateSpy ?? vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }),
  }));
  vi.doMock('ai', () => ({
    streamText: vi.fn().mockReturnValue({
      toDataStreamResponse: vi.fn(
        () => new Response('streamed', { status: 200 }),
      ),
    }),
    StreamData: class {
      appendMessageAnnotation = vi.fn();
      close = vi.fn();
    },
  }));
  vi.doMock('@ai-sdk/openai', () => ({
    createOpenAI: vi.fn(() => () => 'mock-model'),
  }));
}

describe('POST /api/chat — profileContext (sub-projeto 34)', () => {
  it('without perfilId, runRag is called without profileContext', async () => {
    const runRagSpy = vi.fn().mockResolvedValue({
      classification: {
        theory: null,
        intent: 'definition',
        language: 'pt',
        needsRetrieval: true,
      },
      chunks: [],
      sources: [],
      system: 'S',
      user: 'U',
      debug: {
        classifyMs: 1,
        embedMs: 1,
        vectorMs: 1,
        ftsMs: 1,
        rerankMs: 1,
        totalMs: 5,
      },
    });
    commonMocks({ runRagSpy });

    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      makeReq({ messages: [{ role: 'user', content: 'q' }] }),
    );
    expect(res.status).toBe(200);
    expect(runRagSpy).toHaveBeenCalledWith(
      'standalone',
      expect.objectContaining({ profileContext: null }),
    );
  });

  it('with valid perfilId (owned, type=profile, done), forwards snapshot to runRag', async () => {
    const params = sampleProfileParams();
    const getRunForOwnerImpl = vi.fn().mockResolvedValue({
      id: 'perfil-1',
      user_id: 'user-123',
      assistant_type: 'profile',
      template_id: null,
      params,
      output_md: 'done',
      status: 'done',
      error_message: null,
      trace_id: null,
      created_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    });
    const runRagSpy = vi.fn().mockResolvedValue({
      classification: {
        theory: null,
        intent: 'definition',
        language: 'pt',
        needsRetrieval: true,
      },
      chunks: [],
      sources: [],
      system: 'S',
      user: 'U',
      debug: {
        classifyMs: 1,
        embedMs: 1,
        vectorMs: 1,
        ftsMs: 1,
        rerankMs: 1,
        totalMs: 5,
      },
    });
    commonMocks({ runRagSpy, getRunForOwnerImpl });

    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      makeReq({
        messages: [{ role: 'user', content: 'q' }],
        perfilId: 'a8c8eb1c-1234-4def-8abc-1234567890ab',
      }),
    );
    expect(res.status).toBe(200);
    expect(getRunForOwnerImpl).toHaveBeenCalledWith(
      'a8c8eb1c-1234-4def-8abc-1234567890ab',
      'user-123',
    );
    const ragOpts = runRagSpy.mock.calls[0]![1];
    expect(ragOpts.profileContext).toMatchObject({
      id: 'perfil-1',
      nomeCategoria: 'Embalagens flexíveis',
      subSegmentos: ['filmes laminados'],
      requisitosTecnicos: 'ABNT NBR 14937.',
      prioridadeEstrategica: 'qualidade',
    });
  });

  it('with foreign perfilId (getRunForOwner returns null), falls back silently', async () => {
    const getRunForOwnerImpl = vi.fn().mockResolvedValue(null);
    const runRagSpy = vi.fn().mockResolvedValue({
      classification: {
        theory: null,
        intent: 'definition',
        language: 'pt',
        needsRetrieval: true,
      },
      chunks: [],
      sources: [],
      system: 'S',
      user: 'U',
      debug: {
        classifyMs: 1,
        embedMs: 1,
        vectorMs: 1,
        ftsMs: 1,
        rerankMs: 1,
        totalMs: 5,
      },
    });
    commonMocks({ runRagSpy, getRunForOwnerImpl });

    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      makeReq({
        messages: [{ role: 'user', content: 'q' }],
        perfilId: 'a8c8eb1c-1234-4def-8abc-1234567890ab',
      }),
    );
    expect(res.status).toBe(200);
    const ragOpts = runRagSpy.mock.calls[0]![1];
    expect(ragOpts.profileContext).toBeNull();
  });

  it('with non-profile run id, falls back silently', async () => {
    const getRunForOwnerImpl = vi.fn().mockResolvedValue({
      id: 'rfp-1',
      user_id: 'user-123',
      assistant_type: 'rfp',
      params: {},
      status: 'done',
    });
    const runRagSpy = vi.fn().mockResolvedValue({
      classification: {
        theory: null,
        intent: 'definition',
        language: 'pt',
        needsRetrieval: true,
      },
      chunks: [],
      sources: [],
      system: 'S',
      user: 'U',
      debug: {
        classifyMs: 1,
        embedMs: 1,
        vectorMs: 1,
        ftsMs: 1,
        rerankMs: 1,
        totalMs: 5,
      },
    });
    commonMocks({ runRagSpy, getRunForOwnerImpl });

    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      makeReq({
        messages: [{ role: 'user', content: 'q' }],
        perfilId: 'a8c8eb1c-1234-4def-8abc-1234567890ab',
      }),
    );
    expect(res.status).toBe(200);
    expect(runRagSpy.mock.calls[0]![1].profileContext).toBeNull();
  });

  it('with running (not-done) profile, falls back silently', async () => {
    const getRunForOwnerImpl = vi.fn().mockResolvedValue({
      id: 'perfil-1',
      user_id: 'user-123',
      assistant_type: 'profile',
      params: sampleProfileParams(),
      status: 'running',
    });
    const runRagSpy = vi.fn().mockResolvedValue({
      classification: {
        theory: null,
        intent: 'definition',
        language: 'pt',
        needsRetrieval: true,
      },
      chunks: [],
      sources: [],
      system: 'S',
      user: 'U',
      debug: {
        classifyMs: 1,
        embedMs: 1,
        vectorMs: 1,
        ftsMs: 1,
        rerankMs: 1,
        totalMs: 5,
      },
    });
    commonMocks({ runRagSpy, getRunForOwnerImpl });

    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      makeReq({
        messages: [{ role: 'user', content: 'q' }],
        perfilId: 'a8c8eb1c-1234-4def-8abc-1234567890ab',
      }),
    );
    expect(res.status).toBe(200);
    expect(runRagSpy.mock.calls[0]![1].profileContext).toBeNull();
  });
});
