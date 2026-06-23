import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());

type Opts = {
  user?: { id: string } | null;
  allowed?: boolean;
  snap?: Record<string, unknown>;
};

function setup(opts: Opts = {}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi
      .fn()
      .mockResolvedValue('user' in opts ? opts.user : { id: 'u1' }),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi
      .fn()
      .mockResolvedValue(
        opts.allowed === false ? { allowed: false, retryAfterSecs: 42 } : { allowed: true },
      ),
  }));
  vi.doMock('@/lib/fiscal/snapshot', () => ({
    fetchFiscalSnapshot: vi.fn().mockResolvedValue(
      opts.snap ?? {
        enabled: true,
        available: true,
        cnpjData: { razao_social: 'ACME SA', situacao_cadastral: 'ATIVA' },
        risk: { score: 90, risco: 'baixo', recomendacao: 'aprovar' },
      },
    ),
  }));
}

function req(body: unknown) {
  return new Request('http://localhost/api/chat/voice/fiscal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat/voice/fiscal', () => {
  it('401 sem usuário', async () => {
    setup({ user: null });
    const { POST } = await import('@/app/api/chat/voice/fiscal/route');
    expect((await POST(req({ cnpj: '00000000000191' }))).status).toBe(401);
  });

  it('429 rate-limited', async () => {
    setup({ allowed: false });
    const { POST } = await import('@/app/api/chat/voice/fiscal/route');
    expect((await POST(req({ cnpj: '00000000000191' }))).status).toBe(429);
  });

  it('body inválido → 200 com resumo pedindo o CNPJ (a IA precisa falar algo)', async () => {
    setup();
    const { POST } = await import('@/app/api/chat/voice/fiscal/route');
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { resumo: string }).resumo).toMatch(/CNPJ/i);
  });

  it('200 com resumo falável (razão social + situação + risco)', async () => {
    setup();
    const { POST } = await import('@/app/api/chat/voice/fiscal/route');
    const res = await POST(req({ cnpj: '00.000.000/0001-91' }));
    expect(res.status).toBe(200);
    const resumo = ((await res.json()) as { resumo: string }).resumo;
    expect(resumo).toContain('ACME SA');
    expect(resumo).toMatch(/ativa/i);
    expect(resumo).toContain('90');
  });

  it('serviço off → resumo informa indisponibilidade', async () => {
    setup({ snap: { enabled: false, available: false, cnpjData: null, risk: null } });
    const { POST } = await import('@/app/api/chat/voice/fiscal/route');
    const res = await POST(req({ cnpj: '00000000000191' }));
    expect(((await res.json()) as { resumo: string }).resumo).toMatch(/não está disponível/i);
  });
});
