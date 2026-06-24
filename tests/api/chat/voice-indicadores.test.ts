import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());

type Opts = {
  user?: { id: string } | null;
  allowed?: boolean;
  ind?: Record<string, unknown>;
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
  vi.doMock('@/lib/govdata/indicadores', () => ({
    indicadoresAtuais: vi.fn().mockResolvedValue(
      opts.ind ?? {
        selic: { codigo: 432, nome: 'Selic', valor: 14.25, unidade: '% a.a.', data: '05/08/2026' },
        ipca12m: { codigo: 433, nome: 'IPCA', valor: 4.72, unidade: '%', data: '01/05/2026' },
        cambioUsd: { codigo: 1, nome: 'Dólar', valor: 5.17, unidade: 'R$', data: '23/06/2026' },
      },
    ),
    // resumoIndicadores é a fn real seria ideal, mas mockamos pra isolar a rota.
    resumoIndicadores: (i: { selic?: { valor: number } | null }) =>
      i.selic ? `Selic em 14,25% ao ano.` : 'Não consegui consultar os indicadores agora.',
  }));
}

function req() {
  return new Request('http://localhost/api/chat/voice/indicadores', { method: 'POST' });
}

describe('POST /api/chat/voice/indicadores', () => {
  it('401 sem usuário', async () => {
    setup({ user: null });
    const { POST } = await import('@/app/api/chat/voice/indicadores/route');
    expect((await POST()).status).toBe(401);
  });

  it('429 rate-limited', async () => {
    setup({ allowed: false });
    const { POST } = await import('@/app/api/chat/voice/indicadores/route');
    expect((await POST()).status).toBe(429);
  });

  it('200 com resumo falável', async () => {
    setup();
    const { POST } = await import('@/app/api/chat/voice/indicadores/route');
    const res = await POST();
    expect(res.status).toBe(200);
    const resumo = ((await res.json()) as { resumo: string }).resumo;
    expect(resumo).toMatch(/Selic/i);
  });

  it('indicadores indisponíveis → resumo sinaliza', async () => {
    setup({ ind: { selic: null, ipca12m: null, cambioUsd: null } });
    const { POST } = await import('@/app/api/chat/voice/indicadores/route');
    const resumo = ((await (await POST()).json()) as { resumo: string }).resumo;
    expect(resumo).toMatch(/não consegui/i);
  });
});
