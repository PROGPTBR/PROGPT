import { describe, it, expect, beforeEach, vi } from 'vitest';

// POST /api/assistants/pesquisa_precos/aproximado — "Buscar preço e NCM
// aproximado" (backlog do diretor 2026-08-19, Batch G). Mesmo shape de
// auth/rate-limit do catalog-search.

const h = vi.hoisted(() => {
  class NotAuthenticated extends Error {}
  return {
    NotAuthenticated,
    requireUser: vi.fn(),
    checkChatRateLimit: vi.fn(),
    buscarPrecoAproximado: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({ NotAuthenticated: h.NotAuthenticated, requireUser: () => h.requireUser() }));
vi.mock('@/lib/rate-limit', () => ({ checkChatRateLimit: () => h.checkChatRateLimit() }));
vi.mock('@/lib/assistants/precos-aproximado', () => ({
  buscarPrecoAproximado: (input: unknown) => h.buscarPrecoAproximado(input),
}));
vi.mock('@/lib/observability/user-context', () => ({
  withUser: (_id: string, fn: () => unknown) => fn(),
}));

import { POST } from '@/app/api/assistants/pesquisa_precos/aproximado/route';

function req(body: unknown) {
  return new Request('http://localhost/api/assistants/pesquisa_precos/aproximado', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.requireUser.mockReset().mockResolvedValue({ id: 'u1' });
  h.checkChatRateLimit.mockReset().mockResolvedValue({ allowed: true });
  h.buscarPrecoAproximado.mockReset();
});

describe('POST /api/assistants/pesquisa_precos/aproximado', () => {
  it('401 sem usuário', async () => {
    h.requireUser.mockRejectedValue(new h.NotAuthenticated());
    const res = await POST(req({ descricao: 'caneta bic azul' }));
    expect(res.status).toBe(401);
  });

  it('429 quando rate-limited', async () => {
    h.checkChatRateLimit.mockResolvedValue({ allowed: false, retryAfterSecs: 12 });
    const res = await POST(req({ descricao: 'caneta bic azul' }));
    expect(res.status).toBe(429);
  });

  it('400 com body inválido (descricao ausente)', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(h.buscarPrecoAproximado).not.toHaveBeenCalled();
  });

  it('200 devolve o resultado da busca aproximada', async () => {
    h.buscarPrecoAproximado.mockResolvedValue({
      enabled: true,
      available: true,
      precoUnitario: 1.2,
      moeda: 'BRL',
      unidade: 'unidade',
      ncm: '96081000',
      ncmDescricao: 'Canetas esferográficas',
      fontes: [],
      confianca: 0.7,
      observacao: '',
      consultadoEm: '2026-08-22T00:00:00.000Z',
    });
    const res = await POST(req({ descricao: 'caneta bic azul', unidade: 'unidade' }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { precoUnitario: number; ncm: string };
    expect(data.precoUnitario).toBe(1.2);
    expect(data.ncm).toBe('96081000');
    expect(h.buscarPrecoAproximado).toHaveBeenCalledWith({
      descricao: 'caneta bic azul',
      unidade: 'unidade',
    });
  });
});
