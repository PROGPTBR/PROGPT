import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());

function setup(opts: { user?: { id: string } | null; allowed?: boolean } = {}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue('user' in opts ? opts.user : { id: 'u1' }),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi
      .fn()
      .mockResolvedValue(
        opts.allowed === false ? { allowed: false, retryAfterSecs: 30 } : { allowed: true },
      ),
  }));
  vi.doMock('@/lib/govdata/indicadores', () => ({
    painelIndicadores: vi.fn().mockResolvedValue({
      disponivel: true,
      atualizadoEm: '23/06/2026',
      cards: [
        {
          key: 'selic',
          nome: 'Selic (meta)',
          valor: 14.25,
          unidade: '% a.a.',
          data: '23/06/2026',
          tipo: 'taxa',
          descricao: 'x',
          serie: [{ data: '01/06/2026', valor: 14.25 }],
          serieLabel: '% a.a.',
          tendencia: 'flat',
        },
      ],
    }),
  }));
}

const req = (qs = '') => new Request(`http://localhost/api/govdata/indicadores${qs}`);

describe('GET /api/govdata/indicadores', () => {
  it('401 sem usuário', async () => {
    setup({ user: null });
    const { GET } = await import('@/app/api/govdata/indicadores/route');
    expect((await GET(req())).status).toBe(401);
  });

  it('429 rate-limited', async () => {
    setup({ allowed: false });
    const { GET } = await import('@/app/api/govdata/indicadores/route');
    expect((await GET(req())).status).toBe(429);
  });

  it('200 com o painel', async () => {
    setup();
    const { GET } = await import('@/app/api/govdata/indicadores/route');
    const res = await GET(req());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { disponivel: boolean; cards: { key: string }[] };
    expect(data.disponivel).toBe(true);
    expect(data.cards[0]!.key).toBe('selic');
  });

  it('refresh=1 limpa o cache BACEN e responde 200', async () => {
    setup();
    const cleared: string[] = [];
    vi.doMock('@/lib/govdata/cache', () => ({
      clearGovDataCacheByPrefix: (p: string) => cleared.push(p),
    }));
    const { GET } = await import('@/app/api/govdata/indicadores/route');
    const res = await GET(req('?refresh=1'));
    expect(res.status).toBe(200);
    expect(cleared).toContain('bacen');
  });
});
