import { describe, it, expect, beforeEach, vi } from 'vitest';

// GET /api/assistants/pesquisa_precos/catalog-search — autocomplete CATMAT.
// Mesmo shape de auth/rate-limit do /api/suppliers/cnae-search.

const h = vi.hoisted(() => {
  class NotAuthenticated extends Error {}
  return {
    NotAuthenticated,
    requireUser: vi.fn(),
    checkChatRateLimit: vi.fn(),
    suggestCatmatItems: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({ NotAuthenticated: h.NotAuthenticated, requireUser: () => h.requireUser() }));
vi.mock('@/lib/rate-limit', () => ({ checkChatRateLimit: () => h.checkChatRateLimit() }));
vi.mock('@/lib/govdata/precos', () => ({
  suggestCatmatItems: (q: string, o: unknown) => h.suggestCatmatItems(q, o),
}));
vi.mock('@/lib/observability/api-usage', () => ({ recordApiUsage: vi.fn() }));
vi.mock('@/lib/observability/user-context', () => ({
  withUser: (_id: string, fn: () => unknown) => fn(),
}));

import { GET } from '@/app/api/assistants/pesquisa_precos/catalog-search/route';

const req = (q: string) =>
  new Request(`http://localhost/api/assistants/pesquisa_precos/catalog-search?q=${encodeURIComponent(q)}`);

beforeEach(() => {
  h.requireUser.mockReset().mockResolvedValue({ id: 'u1' });
  h.checkChatRateLimit.mockReset().mockResolvedValue({ allowed: true });
  h.suggestCatmatItems.mockReset();
});

describe('GET catalog-search', () => {
  it('401 sem usuário', async () => {
    h.requireUser.mockRejectedValue(new h.NotAuthenticated());
    expect((await GET(req('açúcar'))).status).toBe(401);
  });

  it('429 quando rate-limited', async () => {
    h.checkChatRateLimit.mockResolvedValue({ allowed: false, retryAfterSecs: 12 });
    const res = await GET(req('açúcar refinado'));
    expect(res.status).toBe(429);
  });

  it('vazio sem chamar a sugestão quando q < 3', async () => {
    const res = await GET(req('ab'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { itens: unknown[] };
    expect(data.itens).toEqual([]);
    expect(h.suggestCatmatItems).not.toHaveBeenCalled();
  });

  it('200 com itens e result quando a sugestão resolve', async () => {
    h.suggestCatmatItems.mockResolvedValue({
      codigoClasse: 8925,
      nomeClasse: 'AÇÚCAR E SIMILARES',
      codigoPdm: 19777,
      nomePdm: 'AÇÚCAR',
      itens: [{ codigoItem: 463998, descricaoItem: 'AÇÚCAR, TIPO: REFINADO' }],
    });
    const res = await GET(req('açúcar refinado'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { result: { codigoPdm: number }; itens: { codigoItem: number }[] };
    expect(data.itens[0]!.codigoItem).toBe(463998);
    expect(data.result.codigoPdm).toBe(19777);
  });

  it('200 com itens vazios quando a sugestão é null (govdata off / nada encaixa)', async () => {
    h.suggestCatmatItems.mockResolvedValue(null);
    const res = await GET(req('coisa inexistente'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { result: unknown; itens: unknown[] };
    expect(data.result).toBeNull();
    expect(data.itens).toEqual([]);
  });
});
