import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());

function setup(opts: { user?: { id: string; created_at?: string } | null; canUse?: boolean } = {}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi
      .fn()
      .mockResolvedValue('user' in opts ? opts.user : { id: 'u1', created_at: '2025-01-01' }),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  }));
  vi.doMock('@/lib/billing/subscription', () => ({
    hasAccess: vi.fn().mockResolvedValue(true),
  }));
  vi.doMock('@/lib/billing/quota', () => ({
    canUseAssistant: vi.fn().mockResolvedValue(opts.canUse ?? true),
  }));
  vi.doMock('@/lib/assistants/templates', () => ({
    listTemplates: vi.fn().mockResolvedValue([{ id: 't1' }]),
  }));
  vi.doMock('@/lib/assistants/runs', () => ({
    createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
  }));
}

const body = (params: unknown) =>
  new Request('http://localhost/api/assistants/spend_analysis/create-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params }),
  });

describe('POST /api/assistants/spend_analysis/create-run', () => {
  it('401 sem usuário', async () => {
    setup({ user: null });
    const { POST } = await import('@/app/api/assistants/spend_analysis/create-run/route');
    expect((await POST(body({ analysisName: 'X' }))).status).toBe(401);
  });

  // Decisão 2026-07-07: logado = acesso total (cartão no cadastro, sem
  // bloqueio in-app). O paywall/quota do free tier foi removido do create-run.
  it('200 mesmo com quota "esgotada" (paywall removido)', async () => {
    setup({ canUse: false });
    const { POST } = await import('@/app/api/assistants/spend_analysis/create-run/route');
    const res = await POST(body({ analysisName: 'Análise X', referenceCurrency: 'BRL' }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { runId: string }).runId).toBe('run-1');
  });

  it('400 corpo inválido (sem analysisName)', async () => {
    setup();
    const { POST } = await import('@/app/api/assistants/spend_analysis/create-run/route');
    expect((await POST(body({}))).status).toBe(400);
  });

  it('200 retorna runId', async () => {
    setup();
    const { POST } = await import('@/app/api/assistants/spend_analysis/create-run/route');
    const res = await POST(body({ analysisName: 'Análise X', referenceCurrency: 'BRL' }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { runId: string }).runId).toBe('run-1');
  });
});
