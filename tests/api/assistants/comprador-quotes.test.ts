import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/assistants/comprador/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockCommon(opts: { analyzeResult?: Record<string, unknown> } = {}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  }));
  vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage: vi.fn() }));

  const analyzeComprador = vi.fn().mockResolvedValue({
    result: opts.analyzeResult ?? { severidade: 'info' },
    usage: { tokensIn: 10, tokensOut: 5, tokensCached: 0 },
    model: 'gpt-test',
  });
  vi.doMock('@/lib/assistants/comprador', () => ({ analyzeComprador }));

  const inserted: Record<string, unknown>[] = [];
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({
        insert: (payload: Record<string, unknown>) => {
          inserted.push(payload);
          return {
            select: () => ({
              single: async () => ({ data: { id: 'quote-1', ...payload }, error: null }),
            }),
          };
        },
      }),
    }),
  }));

  return { analyzeComprador, inserted };
}

describe('POST /api/assistants/comprador/quotes', () => {
  it('passes pedido_cotacao through to analyzeComprador and persists it', async () => {
    const { analyzeComprador, inserted } = mockCommon();
    const { POST } = await import('@/app/api/assistants/comprador/quotes/route');

    const res = await POST(
      makeReq({
        propostas: 'Fornecedor A: R$ 100',
        pedido_cotacao: 'Item X, 10un',
      }),
    );

    expect(res.status).toBe(200);
    expect(analyzeComprador).toHaveBeenCalledWith(
      expect.objectContaining({ pedidoCotacao: 'Item X, 10un' }),
    );
    expect(inserted[0]).toMatchObject({ pedido_cotacao: 'Item X, 10un' });
  });

  it('defaults pedido_cotacao to an empty string when omitted (backward-compatible)', async () => {
    const { analyzeComprador, inserted } = mockCommon();
    const { POST } = await import('@/app/api/assistants/comprador/quotes/route');

    const res = await POST(makeReq({ propostas: 'Fornecedor A: R$ 100' }));

    expect(res.status).toBe(200);
    expect(analyzeComprador).toHaveBeenCalledWith(expect.objectContaining({ pedidoCotacao: '' }));
    expect(inserted[0]).toMatchObject({ pedido_cotacao: '' });
  });
});
