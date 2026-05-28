import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupMocks({
  authed = true,
  rateOk = true,
  templateBody = '# Head\n\n<!-- @verbatim-from-here -->\n\nTail.',
}: { authed?: boolean; rateOk?: boolean; templateBody?: string } = {}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue(authed ? { id: 'u-1' } : null),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi
      .fn()
      .mockResolvedValue(
        rateOk ? { allowed: true } : { allowed: false, retryAfterSecs: 30 },
      ),
  }));
  // Sub-projeto 27 paywall: dynamic import inside handler.ts
  vi.doMock('@/lib/billing/quota', () => ({
    canUseAssistant: vi.fn().mockResolvedValue(true),
  }));
  vi.doMock('@/lib/observability/langfuse', () => ({
    startTrace: vi.fn().mockResolvedValue({
      id: 't-1',
      span: () => ({ end: () => {} }),
      end: () => {},
    }),
    flushAsync: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('@/lib/observability/api-usage', () => ({
    recordApiUsage: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('@/lib/rag/retriever', () => ({ retrieve: vi.fn().mockResolvedValue([]) }));
  vi.doMock('@/lib/rag/reranker', () => ({ rerank: vi.fn().mockResolvedValue([]) }));
  vi.doMock('@/lib/db/user-company', () => ({
    getUserCompany: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock('@/lib/assistants/templates', () => ({
    getTemplate: vi.fn().mockResolvedValue(
      templateBody
        ? {
            id: 'tpl-1',
            assistant_type: 'kraljic',
            name: 'Kraljic Padrão',
            description: null,
            body_md: templateBody,
            created_by: null,
            created_at: '',
            updated_at: '',
          }
        : null,
    ),
  }));
  vi.doMock('@/lib/assistants/runs', () => ({
    createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
    updateRunOutput: vi.fn().mockResolvedValue(true),
    failRun: vi.fn().mockResolvedValue(true),
  }));
  // streamText is the main external call — return a stub that exposes
  // toDataStreamResponse with the same Response API the route uses.
  vi.doMock('ai', () => ({
    streamText: vi.fn(() => ({
      toDataStreamResponse: (init: { headers?: Record<string, string> } = {}) =>
        new Response('0:""\n', { status: 200, headers: init.headers ?? {} }),
    })),
    StreamData: class {
      appendMessageAnnotation() {}
      close() {}
    },
  }));
  vi.doMock('@ai-sdk/openai', () => ({
    createOpenAI: () => () => 'mock-model',
  }));
  vi.doMock('@/lib/env', () => ({
    requireEnv: () => 'sk-test',
  }));
}

function buildPost(body: unknown): Request {
  return new Request('http://x/api/assistants/kraljic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  templateId: '00000000-0000-0000-0000-000000000001',
  params: {
    portfolioName: 'Test',
    notes: '',
    items: [
      { name: 'A', segment: 'D', category: 'cat',
        spendMM: 10, criticality: 2, technicalSpec: 2, customerValue: 2,
        marketStructure: 2, marketRivalry: 2, supplierPower: 2, supplierSwitching: 2 },
      { name: 'B', segment: 'I', category: 'cat',
        spendMM: 5, criticality: 1, technicalSpec: 1, customerValue: 1,
        marketStructure: 1, marketRivalry: 1, supplierPower: 1, supplierSwitching: 1 },
    ],
  },
};

describe('POST /api/assistants/kraljic', () => {
  it('returns 401 when unauthenticated', async () => {
    setupMocks({ authed: false });
    const { POST } = await import('@/app/api/assistants/kraljic/route');
    const res = await POST(buildPost(validBody));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (missing items)', async () => {
    setupMocks();
    const { POST } = await import('@/app/api/assistants/kraljic/route');
    const res = await POST(buildPost({ templateId: '00000000-0000-0000-0000-000000000001', params: { portfolioName: 'p', items: [] } }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid templateId (not uuid)', async () => {
    setupMocks();
    const { POST } = await import('@/app/api/assistants/kraljic/route');
    const res = await POST(
      buildPost({ ...validBody, templateId: 'not-a-uuid' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate-limited', async () => {
    setupMocks({ rateOk: false });
    const { POST } = await import('@/app/api/assistants/kraljic/route');
    const res = await POST(buildPost(validBody));
    expect(res.status).toBe(429);
  });

  it('returns 400 when the template is not found', async () => {
    setupMocks({ templateBody: '' });
    const { POST } = await import('@/app/api/assistants/kraljic/route');
    const res = await POST(buildPost(validBody));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe('template_not_found');
  });

  it('returns 200 + X-Run-Id header on the happy path', async () => {
    setupMocks();
    const { POST } = await import('@/app/api/assistants/kraljic/route');
    const res = await POST(buildPost(validBody));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-run-id')).toBe('run-1');
  });
});
