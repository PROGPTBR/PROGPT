import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());

type Opts = { user?: { id: string } | null; allowed?: boolean };

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
  vi.doMock('@/lib/suppliers/enrichment', () => ({
    enrichSupplier: vi.fn().mockResolvedValue({
      fiscal: { available: true, situacao: 'ATIVA', score: 90, risco: 'baixo' },
      historico: { consultado: true, forneceAoGoverno: true, totalItens: 2, ufs: ['SP'], periodoMeses: 12 },
      sancoes: { enabled: true, consultado: true, temSancao: false, total: 0, amostra: [] },
      resumo: 'ATIVA · risco baixo · 2 contratos públicos/12m',
    }),
  }));
}

function req(body: unknown) {
  return new Request('http://localhost/api/suppliers/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/suppliers/enrich', () => {
  it('401 sem usuário', async () => {
    setup({ user: null });
    const { POST } = await import('@/app/api/suppliers/enrich/route');
    expect((await POST(req({ cnpjs: ['00000000000191'] }))).status).toBe(401);
  });

  it('429 rate-limited', async () => {
    setup({ allowed: false });
    const { POST } = await import('@/app/api/suppliers/enrich/route');
    expect((await POST(req({ cnpjs: ['00000000000191'] }))).status).toBe(429);
  });

  it('400 com lista vazia', async () => {
    setup();
    const { POST } = await import('@/app/api/suppliers/enrich/route');
    expect((await POST(req({ cnpjs: [] }))).status).toBe(400);
  });

  it('200 retorna enriquecimento (fiscal + histórico + sanções) por CNPJ (14 dígitos normalizados)', async () => {
    setup();
    const { POST } = await import('@/app/api/suppliers/enrich/route');
    const res = await POST(req({ cnpjs: ['00.000.000/0001-91', 'lixo', '00000000000191'] }));
    expect(res.status).toBe(200);
    const b = (await res.json()) as {
      results: Record<
        string,
        {
          fiscal: { situacao: string; score: number };
          historico: { forneceAoGoverno: boolean; totalItens: number };
          sancoes: { temSancao: boolean };
          resumo: string;
        }
      >;
    };
    // de-dup + só os 14-dígitos válidos
    expect(Object.keys(b.results)).toEqual(['00000000000191']);
    expect(b.results['00000000000191']!.fiscal.situacao).toBe('ATIVA');
    expect(b.results['00000000000191']!.fiscal.score).toBe(90);
    expect(b.results['00000000000191']!.historico.forneceAoGoverno).toBe(true);
    expect(b.results['00000000000191']!.sancoes.temSancao).toBe(false);
    expect(b.results['00000000000191']!.resumo).toContain('ATIVA');
  });
});
