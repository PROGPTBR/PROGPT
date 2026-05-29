import { describe, it, expect, beforeEach, vi } from 'vitest';

// Sub-projeto: cap de turnos free no simulador de negociação (#6 go-live).
// O cap roda ANTES de qualquer geração LLM, então estes testes não precisam
// mockar streamText — o early-return de 402 é alcançado primeiro.

beforeEach(() => {
  vi.resetModules();
});

function mockBase(opts: {
  isPro: boolean;
  userTurns: number;
}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
  }));
  vi.doMock('@/lib/observability/user-context', () => ({
    withUser: (_id: string, fn: () => unknown) => fn(),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  }));
  vi.doMock('@/lib/billing/subscription', () => ({
    isPro: vi.fn().mockResolvedValue(opts.isPro),
  }));
  // Run existe, é do tipo negociação, e tem setup válido.
  vi.doMock('@/lib/assistants/runs', () => ({
    getRunForOwner: vi.fn().mockResolvedValue({
      id: 'run1',
      assistant_type: 'negotiation',
      params: { supplierName: 'X', category: 'Y', simulator: { persona: 'tough' } },
      strategy: null,
    }),
    updateRunTranscript: vi.fn().mockResolvedValue(true),
  }));
}

function makeReq(userTurns: number): Request {
  const messages = [];
  for (let i = 0; i < userTurns; i++) {
    messages.push({ role: 'user', content: `turno ${i}` });
    if (i < userTurns - 1) messages.push({ role: 'assistant', content: `resp ${i}` });
  }
  return new Request('http://localhost/api/assistants/runs/run1/negotiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
}

describe('POST /api/assistants/runs/[id]/negotiate — cap de turnos free', () => {
  it('retorna 402 paywall quando free passa do cap (31º turno)', async () => {
    mockBase({ isPro: false, userTurns: 31 });
    const { POST } = await import('@/app/api/assistants/runs/[id]/negotiate/route');
    const res = await POST(makeReq(31), { params: { id: 'run1' } });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('paywall');
    expect(body.reason).toBe('turn_cap');
  });
});
