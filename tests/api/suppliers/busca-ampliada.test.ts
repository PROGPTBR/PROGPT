import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

const LIBERADA = 'camila.santos@costafeitosa.com.br';

function mockAuth(email: string | null) {
  vi.doMock('@/lib/auth', async () => {
    const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
    return {
      ...actual,
      getCurrentUser: vi.fn().mockResolvedValue(email ? { id: 'u1', email } : null),
    };
  });
}

function mockServer() {
  const carregar = vi.fn().mockResolvedValue([
    {
      razaoSocial: 'GERDAU',
      nomeFantasia: null,
      cnpj: null,
      categoria: 'AÇO',
      municipio: 'São Paulo',
      uf: 'SP',
      telefone: null,
      email: 'x@gerdau.com',
      notas: null,
    },
  ]);
  const web = vi.fn().mockResolvedValue({ fornecedores: [{ nome: 'Loja X' }], texto: null, erro: null });
  vi.doMock('@/lib/suppliers/busca-ampliada-server', () => ({
    carregarVendorListDaEquipe: carregar,
    escolherCategorias: vi.fn().mockResolvedValue(['AÇO']),
    buscarFornecedoresNaWeb: web,
  }));
  const rl = vi.fn().mockResolvedValue({ allowed: true });
  vi.doMock('@/lib/rate-limit', () => ({ checkChatRateLimit: rl }));
  return { carregar, web, rl };
}

function post(body: unknown) {
  return new Request('http://localhost/api/suppliers/busca-ampliada', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/suppliers/busca-ampliada', () => {
  it('401 sem login', async () => {
    mockAuth(null);
    mockServer();
    const { POST } = await import('@/app/api/suppliers/busca-ampliada/route');
    expect((await POST(post({ consulta: 'vergalhão' }))).status).toBe(401);
  });

  it('404 para quem não está liberado — nem lê a vendor list', async () => {
    mockAuth('alguem@outra.com.br');
    const { carregar, web } = mockServer();
    const { POST, GET } = await import('@/app/api/suppliers/busca-ampliada/route');
    expect((await POST(post({ consulta: 'vergalhão' }))).status).toBe(404);
    expect((await GET()).status).toBe(404);
    expect(carregar).not.toHaveBeenCalled();
    expect(web).not.toHaveBeenCalled();
  });

  it('busca na vendor list da equipe e na internet', async () => {
    mockAuth(LIBERADA);
    const { carregar } = mockServer();
    const { POST } = await import('@/app/api/suppliers/busca-ampliada/route');
    const res = await POST(post({ consulta: 'vergalhão em São Paulo' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(carregar.mock.calls[0]![0].id).toBe('costa-feitosa');
    expect(json.vendorList.total).toBe(1);
    expect(json.vendorList.resultados[0].razaoSocial).toBe('GERDAU');
    expect(json.web.fornecedores[0].nome).toBe('Loja X');
  });

  it('vendor list falhando não derruba a internet', async () => {
    mockAuth(LIBERADA);
    const { carregar } = mockServer();
    carregar.mockRejectedValueOnce(new Error('db fora'));
    const { POST } = await import('@/app/api/suppliers/busca-ampliada/route');
    const json = await (await POST(post({ consulta: 'vergalhão' }))).json();
    expect(json.vendorList.erro).toMatch(/vendor list/);
    expect(json.web.fornecedores).toHaveLength(1);
  });

  it('400 com pedido curto demais', async () => {
    mockAuth(LIBERADA);
    mockServer();
    const { POST } = await import('@/app/api/suppliers/busca-ampliada/route');
    expect((await POST(post({ consulta: 'a' }))).status).toBe(400);
  });

  it('GET devolve o tamanho da vendor list da equipe', async () => {
    mockAuth(LIBERADA);
    mockServer();
    const { GET } = await import('@/app/api/suppliers/busca-ampliada/route');
    const json = await (await GET()).json();
    expect(json).toEqual({ equipe: 'Costa Feitosa', total: 1, categorias: 1 });
  });

  it('parte vendorList responde só a vendor list, sem internet e sem gastar o limite', async () => {
    mockAuth(LIBERADA);
    const { web, rl } = mockServer();
    const { POST } = await import('@/app/api/suppliers/busca-ampliada/route');
    const json = await (await POST(post({ consulta: 'vergalhão', parte: 'vendorList' }))).json();
    expect(json.vendorList.resultados[0].razaoSocial).toBe('GERDAU');
    expect(json.web).toBeUndefined();
    expect(web).not.toHaveBeenCalled();
    expect(rl).not.toHaveBeenCalled();
  });

  it('parte web responde só a internet e conta no limite', async () => {
    mockAuth(LIBERADA);
    const { carregar, rl } = mockServer();
    const { POST } = await import('@/app/api/suppliers/busca-ampliada/route');
    const json = await (await POST(post({ consulta: 'vergalhão', parte: 'web' }))).json();
    expect(json.web.fornecedores[0].nome).toBe('Loja X');
    expect(json.vendorList).toBeUndefined();
    expect(carregar).not.toHaveBeenCalled();
    expect(rl).toHaveBeenCalled();
  });
});
