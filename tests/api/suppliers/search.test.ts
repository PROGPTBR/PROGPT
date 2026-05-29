import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/suppliers/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockAuth(user: { id: string } | null) {
  vi.doMock('@/lib/auth', async () => {
    const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
    return {
      ...actual,
      getCurrentUser: vi.fn().mockResolvedValue(user),
      requireUser: vi
        .fn()
        .mockImplementation(() =>
          user ? Promise.resolve(user) : Promise.reject(new actual.NotAuthenticated()),
        ),
    };
  });
}

vi.mock('@/lib/observability/api-usage', () => ({
  recordApiUsage: vi.fn(),
}));

describe('POST /api/suppliers/search', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(null);
    vi.doMock('@/lib/rate-limit', () => ({
      checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    vi.doMock('@/lib/suppliers/search', () => ({ searchSuppliers: vi.fn() }));
    const { POST } = await import('@/app/api/suppliers/search/route');
    const res = await POST(makeReq({ cnae: '2222600' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when cnae is not numeric', async () => {
    mockAuth({ id: 'u1' });
    vi.doMock('@/lib/rate-limit', () => ({
      checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    vi.doMock('@/lib/suppliers/search', () => ({ searchSuppliers: vi.fn() }));
    const { POST } = await import('@/app/api/suppliers/search/route');
    const res = await POST(makeReq({ cnae: 'abc' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when limit is out of range', async () => {
    mockAuth({ id: 'u1' });
    vi.doMock('@/lib/rate-limit', () => ({
      checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    vi.doMock('@/lib/suppliers/search', () => ({ searchSuppliers: vi.fn() }));
    const { POST } = await import('@/app/api/suppliers/search/route');
    const res = await POST(makeReq({ cnae: '2222600', limit: 9999 }));
    expect(res.status).toBe(400);
  });

  it('forwards search results on happy path', async () => {
    mockAuth({ id: 'u1' });
    vi.doMock('@/lib/rate-limit', () => ({
      checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const searchSuppliers = vi.fn().mockResolvedValue({
      groups: [
        {
          cnpjBasico: '12345678',
          units: [
            {
              cnpj: '12345678000190',
              razao_social: 'X',
              nome_fantasia: null,
              cnae_primario: '2222600',
              cnaes_secundarios: null,
              porte: 'ME',
              capital_social: 1000,
              faixa_funcionarios: null,
              uf: 'SP',
              municipio: 'Sao Paulo',
              telefone: null,
              email: null,
              ultima_atualizacao_rf: null,
            },
          ],
        },
      ],
      total: 1,
      cnaeName: 'Fabricação',
    });
    vi.doMock('@/lib/suppliers/search', () => ({ searchSuppliers }));
    const { POST } = await import('@/app/api/suppliers/search/route');
    const res = await POST(makeReq({ cnae: '2222600', ufs: ['SP'] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].units).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(searchSuppliers).toHaveBeenCalledWith({ cnae: '2222600', ufs: ['SP'] });
  });
});

describe('GET /api/suppliers/cnae-search', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(null);
    vi.doMock('@/lib/suppliers/cnae-lookup', () => ({ searchCnaesByText: vi.fn() }));
    const { GET } = await import('@/app/api/suppliers/cnae-search/route');
    const res = await GET(
      new Request('http://localhost/api/suppliers/cnae-search?q=foo'),
    );
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockAuth({ id: 'u1' });
    vi.doMock('@/lib/rate-limit', () => ({
      checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: false, retryAfterSecs: 30 }),
    }));
    const searchCnaesByText = vi.fn();
    vi.doMock('@/lib/suppliers/cnae-lookup', () => ({ searchCnaesByText }));
    const { GET } = await import('@/app/api/suppliers/cnae-search/route');
    const res = await GET(
      new Request('http://localhost/api/suppliers/cnae-search?q=embalagens'),
    );
    expect(res.status).toBe(429);
    expect(searchCnaesByText).not.toHaveBeenCalled();
  });

  it('returns empty results when query is too short', async () => {
    mockAuth({ id: 'u1' });
    vi.doMock('@/lib/rate-limit', () => ({
      checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const searchCnaesByText = vi.fn();
    vi.doMock('@/lib/suppliers/cnae-lookup', () => ({ searchCnaesByText }));
    const { GET } = await import('@/app/api/suppliers/cnae-search/route');
    const res = await GET(
      new Request('http://localhost/api/suppliers/cnae-search?q=a'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(searchCnaesByText).not.toHaveBeenCalled();
  });

  it('forwards autocomplete results on happy path', async () => {
    mockAuth({ id: 'u1' });
    vi.doMock('@/lib/rate-limit', () => ({
      checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const results = [{ code: '2222600', name: 'Fabricação...', divisao: null, grupo: null }];
    vi.doMock('@/lib/suppliers/cnae-lookup', () => ({
      searchCnaesByText: vi.fn().mockResolvedValue(results),
    }));
    const { GET } = await import('@/app/api/suppliers/cnae-search/route');
    const res = await GET(
      new Request('http://localhost/api/suppliers/cnae-search?q=embalagens'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual(results);
  });
});
