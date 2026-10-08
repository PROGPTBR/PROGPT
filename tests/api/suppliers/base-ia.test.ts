import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());

function mocks(user: { id: string; email: string } | null) {
  vi.doMock('@/lib/auth', async () => ({ ...(await vi.importActual<object>('@/lib/auth')), getCurrentUser: vi.fn().mockResolvedValue(user) }));
  vi.doMock('@/lib/rate-limit', () => ({ checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));
  const rows = [
    { id: 's1', razao_social: 'DF BLOCOS', nome_fantasia: null, cnpj: null, categoria: 'BLOCO DE CONCRETO', municipio: 'Sorocaba', uf: 'SP', telefone: null, email: null, notas: null },
    { id: 's2', razao_social: 'Cerâmica Paulista', nome_fantasia: null, cnpj: null, categoria: 'BLOCO CERÂMICO', municipio: 'Itu', uf: 'SP', telefone: null, email: null, notas: null },
    { id: 's3', razao_social: 'Gerdau', nome_fantasia: null, cnpj: null, categoria: 'AÇO', municipio: 'São Paulo', uf: 'SP', telefone: null, email: null, notas: null },
  ];
  vi.doMock('@/lib/db/supabase-server', () => ({
    supabaseServer: () => ({ from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: rows, error: null }) }) }) }),
  }));
  vi.doMock('@/lib/suppliers/busca-ampliada-server', () => ({
    escolherCategorias: vi.fn().mockResolvedValue(['BLOCO CERÂMICO', 'BLOCO DE CONCRETO']),
  }));
}
const req = (body: unknown) => new Request('http://x/api/suppliers/base-ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('/api/suppliers/base-ia', () => {
  it('401 sem login', async () => {
    mocks(null);
    const { POST } = await import('@/app/api/suppliers/base-ia/route');
    expect((await POST(req({ consulta: 'blocos' }))).status).toBe(401);
  });

  it('devolve os fornecedores da base nos grupos que a IA escolheu, na ordem dela, com o motivo', async () => {
    mocks({ id: 'u1', email: 'x@y.com' });
    const { POST } = await import('@/app/api/suppliers/base-ia/route');
    const json = await (await POST(req({ consulta: 'material para alvenaria' }))).json();
    expect(json.categorias).toEqual(['BLOCO CERÂMICO', 'BLOCO DE CONCRETO']);
    expect(json.resultados.map((r: { id: string }) => r.id)).toEqual(['s2', 's1']);
    expect(json.resultados[0].motivo).toMatch(/BLOCO CERÂMICO/);
  });

  it('400 com pedido vazio', async () => {
    mocks({ id: 'u1', email: 'x@y.com' });
    const { POST } = await import('@/app/api/suppliers/base-ia/route');
    expect((await POST(req({ consulta: ' ' }))).status).toBe(400);
  });
});
