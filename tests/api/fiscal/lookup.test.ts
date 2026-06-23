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
        cnpjData: {
          razao_social: 'ACME SA',
          situacao_cadastral: 'ATIVA',
          natureza_juridica: 'LTDA',
          endereco: { municipio: 'SAO PAULO', uf: 'SP' },
        },
        risk: { score: 88, risco: 'baixo', recomendacao: 'aprovar' },
      },
    ),
  }));
}

function req(body: unknown) {
  return new Request('http://localhost/api/fiscal/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/fiscal/lookup', () => {
  it('401 sem usuário', async () => {
    setup({ user: null });
    const { POST } = await import('@/app/api/fiscal/lookup/route');
    expect((await POST(req({ cnpj: '00000000000191' }))).status).toBe(401);
  });

  it('429 quando rate-limited', async () => {
    setup({ allowed: false });
    const { POST } = await import('@/app/api/fiscal/lookup/route');
    expect((await POST(req({ cnpj: '00000000000191' }))).status).toBe(429);
  });

  it('400 com body inválido', async () => {
    setup();
    const { POST } = await import('@/app/api/fiscal/lookup/route');
    expect((await POST(req({ cnpj: 'x' }))).status).toBe(400);
  });

  it('200 achata o snapshot (razão social, situação, score)', async () => {
    setup();
    const { POST } = await import('@/app/api/fiscal/lookup/route');
    const res = await POST(req({ cnpj: '00.000.000/0001-91' }));
    expect(res.status).toBe(200);
    const b = (await res.json()) as Record<string, unknown>;
    expect(b.razaoSocial).toBe('ACME SA');
    expect(b.situacao).toBe('ATIVA');
    expect(b.uf).toBe('SP');
    expect(b.score).toBe(88);
  });
});
