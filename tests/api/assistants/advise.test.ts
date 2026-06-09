import { describe, it, expect, beforeEach, vi } from 'vitest';

// Sub-projeto 34 — coach inline (/advise). Testa os early-returns pré-LLM
// (mesmo estilo do negotiate.test.ts — sem mockar streamText).

beforeEach(() => {
  vi.resetModules();
});

const VALID_SETUP = {
  personaProfile: 'colaborativo',
  supplierObjectives: 'manter margem',
  supplierWalkaway: 'piso de 90',
};

function mockBase(opts: {
  user?: { id: string } | null;
  run?: Record<string, unknown> | null;
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
    checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
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
}

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/assistants/runs/run1/advise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const MESSAGES = [
  { role: 'assistant', content: 'Nosso preço é 120.' },
  { role: 'user', content: 'Consigo 100 no concorrente.' },
];

describe('POST /api/assistants/runs/[id]/advise', () => {
  it('401 sem usuário', async () => {
    mockBase({ user: null });
    const { POST } = await import('@/app/api/assistants/runs/[id]/advise/route');
    const res = await POST(makeReq({ messages: MESSAGES }), { params: { id: 'run1' } });
    expect(res.status).toBe(401);
  });

  it('400 com body inválido', async () => {
    mockBase({});
    const { POST } = await import('@/app/api/assistants/runs/[id]/advise/route');
    const res = await POST(makeReq({ messages: 'não é array' }), {
      params: { id: 'run1' },
    });
    expect(res.status).toBe(400);
  });

  it('404 quando a run não é do usuário', async () => {
    mockBase({ run: null });
    const { POST } = await import('@/app/api/assistants/runs/[id]/advise/route');
    const res = await POST(makeReq({ messages: MESSAGES }), { params: { id: 'run1' } });
    expect(res.status).toBe(404);
  });

  it('409 quando o simulador não tem setup', async () => {
    mockBase({
      run: {
        id: 'run1',
        assistant_type: 'negotiation',
        params: { supplierName: 'X', category: 'Y' }, // sem simulator
        strategy: null,
      },
    });
    const { POST } = await import('@/app/api/assistants/runs/[id]/advise/route');
    const res = await POST(makeReq({ messages: MESSAGES }), { params: { id: 'run1' } });
    expect(res.status).toBe(409);
  });
});
