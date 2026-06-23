import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe('fetchFiscalSnapshot', () => {
  it('serviço off (sem FISCAL_API_URL) → enabled:false, available:false', async () => {
    vi.stubEnv('FISCAL_API_URL', '');
    const { fetchFiscalSnapshot } = await import('@/lib/fiscal/snapshot');
    const s = await fetchFiscalSnapshot('00000000000191');
    expect(s.enabled).toBe(false);
    expect(s.available).toBe(false);
    expect(s.cnpjData).toBeNull();
  });

  it('com serviço → cadastro + risco (tolerante a falha parcial)', async () => {
    vi.doMock('@/lib/fiscal/client', () => ({
      isFiscalEnabled: () => true,
      consultarCnpj: vi
        .fn()
        .mockResolvedValue({ razao_social: 'ACME SA', situacao_cadastral: 'ATIVA' }),
      riskScoreSupplier: vi
        .fn()
        .mockResolvedValue({ score: 88, risco: 'baixo', recomendacao: 'aprovar' }),
    }));
    const { fetchFiscalSnapshot } = await import('@/lib/fiscal/snapshot');
    const s = await fetchFiscalSnapshot('00000000000191');
    expect(s.available).toBe(true);
    expect(s.cnpjData?.razao_social).toBe('ACME SA');
    expect(s.risk?.score).toBe(88);
  });

  it('ambas as consultas falham → available:false + error', async () => {
    vi.doMock('@/lib/fiscal/client', () => ({
      isFiscalEnabled: () => true,
      consultarCnpj: vi.fn().mockRejectedValue(new Error('boom')),
      riskScoreSupplier: vi.fn().mockRejectedValue(new Error('boom')),
    }));
    const { fetchFiscalSnapshot } = await import('@/lib/fiscal/snapshot');
    const s = await fetchFiscalSnapshot('00000000000191');
    expect(s.available).toBe(false);
    expect(s.error).toBeTruthy();
  });
});
