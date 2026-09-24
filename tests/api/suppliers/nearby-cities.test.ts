import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

class NotAuthenticated extends Error {}

function mockAuth(authed: boolean) {
  vi.doMock('@/lib/auth', () => ({
    NotAuthenticated,
    requireUser: vi.fn().mockImplementation(async () => {
      if (!authed) throw new NotAuthenticated();
      return { id: 'u1', email: 'comprador@obra.com' };
    }),
  }));
}

function get(qs: string) {
  return new Request(`http://x/api/suppliers/nearby-cities?${qs}`);
}

describe('GET /api/suppliers/nearby-cities', () => {
  it('401 sem sessão', async () => {
    mockAuth(false);
    const { GET } = await import('@/app/api/suppliers/nearby-cities/route');
    expect((await GET(get('uf=SP&cidade=Itupeva&raio=30'))).status).toBe(401);
  });

  it('devolve as cidades vizinhas com id do IBGE e distância', async () => {
    mockAuth(true);
    const { GET } = await import('@/app/api/suppliers/nearby-cities/route');
    const res = await GET(get('uf=SP&cidade=Itupeva&raio=30'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      origem: { cidade: string };
      cidades: Array<{ id: number; nome: string; uf: string; distanciaKm: number }>;
    };

    expect(body.origem.cidade).toBe('Itupeva');
    expect(body.cidades.map((c) => c.nome)).toContain('Jundiaí');
    // O id é o código IBGE — a UI mescla na seleção por ele.
    expect(body.cidades[0]!.id).toBeGreaterThan(1000000);
  });

  it('404 com mensagem em português para cidade desconhecida', async () => {
    mockAuth(true);
    const { GET } = await import('@/app/api/suppliers/nearby-cities/route');
    const res = await GET(get('uf=SP&cidade=Xanadu&raio=30'));

    expect(res.status).toBe(404);
    expect((await res.json()).message).toMatch(/não encontramos essa cidade/i);
  });

  it('recusa parâmetros inválidos em vez de devolver o país inteiro', async () => {
    mockAuth(true);
    const { GET } = await import('@/app/api/suppliers/nearby-cities/route');
    expect((await GET(get('uf=SAOPAULO&cidade=Itupeva&raio=30'))).status).toBe(400);
    expect((await GET(get('uf=SP&cidade=Itupeva&raio=9999'))).status).toBe(400);
    expect((await GET(get('uf=SP&cidade=&raio=30'))).status).toBe(400);
  });

  it('avisa quando o raio estourou o teto de cidades', async () => {
    mockAuth(true);
    const { GET } = await import('@/app/api/suppliers/nearby-cities/route');
    const res = await GET(get('uf=SP&cidade=São Paulo&raio=300'));
    const body = (await res.json()) as { limitado: boolean };
    expect(body.limitado).toBe(true);
  });
});
