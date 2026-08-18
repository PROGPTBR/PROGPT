import { describe, expect, it, vi, beforeEach } from 'vitest';

// Rota de sync do Simulador Tributário (espelho servidor do localStorage).
// GET devolve os clientes na forma que o bundle espera; POST substitui o
// conjunto do usuário (upsert + apaga ausentes).

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(authed: boolean, userId = 'user-1') {
  vi.doMock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>();
    return {
      ...actual,
      requireUser: vi.fn().mockImplementation(async () => {
        if (!authed) throw new actual.NotAuthenticated();
        return { id: userId, email: 'me@x.com' };
      }),
    };
  });
}

type Results = {
  select?: { data: unknown; error: unknown };
  upsert?: { error: unknown };
  del?: { error: unknown };
};

function mockSupabase(results: Results) {
  const spies = { upsert: vi.fn(), delete: vi.fn(), not: vi.fn() };
  const builder: Record<string, unknown> = {};
  let op: 'select' | 'upsert' | 'del' = 'select';
  Object.assign(builder, {
    from: () => builder,
    select: () => {
      op = 'select';
      return builder;
    },
    eq: () => builder,
    order: () => builder,
    upsert: (...args: unknown[]) => {
      op = 'upsert';
      spies.upsert(...args);
      return builder;
    },
    delete: () => {
      op = 'del';
      spies.delete();
      return builder;
    },
    not: (...args: unknown[]) => {
      spies.not(...args);
      return builder;
    },
    then: (resolve: (v: unknown) => unknown) => {
      const r =
        op === 'select'
          ? results.select ?? { data: [], error: null }
          : op === 'upsert'
            ? results.upsert ?? { error: null }
            : results.del ?? { error: null };
      return Promise.resolve(r).then(resolve);
    },
  });
  vi.doMock('@/lib/db/supabase', () => ({ getServerSupabase: () => builder }));
  return spies;
}

async function loadRoute() {
  return import('@/app/api/simulador/sync/route');
}

describe('GET /api/simulador/sync', () => {
  it('401 quando não autenticado', async () => {
    mockAuth(false);
    mockSupabase({});
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('devolve clientes na forma do localStorage (cliente_id → id)', async () => {
    mockAuth(true);
    mockSupabase({
      select: {
        data: [
          {
            cliente_id: 'cli-1',
            nome: 'ACME',
            cnpj: '12345678000199',
            versoes: [{ id: 'v1', versao: 1, dados: { rbt12: 100 }, criadoEm: 'x' }],
          },
        ],
        error: null,
      },
    });
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      {
        id: 'cli-1',
        nome: 'ACME',
        cnpj: '12345678000199',
        versoes: [{ id: 'v1', versao: 1, dados: { rbt12: 100 }, criadoEm: 'x' }],
      },
    ]);
  });

  it('500 quando o select falha', async () => {
    mockAuth(true);
    mockSupabase({ select: { data: null, error: { message: 'boom' } } });
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/simulador/sync', () => {
  function req(body: unknown) {
    return new Request('http://localhost/api/simulador/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('401 quando não autenticado', async () => {
    mockAuth(false);
    mockSupabase({});
    const { POST } = await loadRoute();
    const res = await POST(req([]));
    expect(res.status).toBe(401);
  });

  it('400 quando o corpo não é um array de clientes válido', async () => {
    mockAuth(true);
    mockSupabase({});
    const { POST } = await loadRoute();
    const res = await POST(req([{ nome: 'sem id' }]));
    expect(res.status).toBe(400);
  });

  it('upserta os clientes e normaliza o CNPJ (só dígitos)', async () => {
    mockAuth(true);
    const spies = mockSupabase({});
    const { POST } = await loadRoute();
    const res = await POST(
      req([
        {
          id: 'cli-1',
          nome: 'ACME',
          cnpj: '12.345.678/0001-99',
          versoes: [{ id: 'v1', versao: 1, dados: {}, criadoEm: 'x' }],
        },
      ]),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, count: 1 });
    const rows = spies.upsert.mock.calls[0]![0] as Array<Record<string, unknown>>;
    const row = rows[0]!;
    expect(row.cliente_id).toBe('cli-1');
    expect(row.cnpj).toBe('12345678000199');
    expect(row.user_id).toBe('user-1');
  });

  it('array vazio apaga tudo do usuário (sem upsert)', async () => {
    mockAuth(true);
    const spies = mockSupabase({});
    const { POST } = await loadRoute();
    const res = await POST(req([]));
    expect(res.status).toBe(200);
    expect(spies.upsert).not.toHaveBeenCalled();
    expect(spies.delete).toHaveBeenCalled();
    // sem keepIds → delete não filtra por not()
    expect(spies.not).not.toHaveBeenCalled();
  });
});
