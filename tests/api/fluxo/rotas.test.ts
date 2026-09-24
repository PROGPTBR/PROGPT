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
      return { id: 'u1', email: 'comprador@empresa.com' };
    }),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  }));
}

function mockProcess(over: Record<string, unknown> = {}) {
  const mod = {
    listarProcessos: vi.fn().mockResolvedValue([]),
    criarProcesso: vi.fn().mockResolvedValue({ id: 'p1' }),
    getProcesso: vi.fn().mockResolvedValue({ processo: { id: 'p1' }, etapas: [] }),
    rodarEtapa: vi.fn().mockResolvedValue({ ok: true, etapa: { id: 'e1' } }),
    decidirEtapa: vi.fn().mockResolvedValue({ ok: true, processo: { id: 'p1' }, concluido: false }),
    ...over,
  };
  vi.doMock('@/lib/fluxo/process', () => mod);
  return mod;
}

function post(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/fluxo/processos', () => {
  it('401 sem sessão', async () => {
    mockAuth(false);
    mockProcess();
    const { POST } = await import('@/app/api/fluxo/processos/route');
    const res = await POST(post('http://x', { requisicao: 'preciso de 10 notebooks' }));
    expect(res.status).toBe(401);
  });

  it('recusa requisição vazia com mensagem em português', async () => {
    mockAuth(true);
    mockProcess();
    const { POST } = await import('@/app/api/fluxo/processos/route');
    const res = await POST(post('http://x', { requisicao: 'oi' }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/necessidade da compra/i);
  });

  it('abre o processo e devolve o id', async () => {
    mockAuth(true);
    const mod = mockProcess();
    const { POST } = await import('@/app/api/fluxo/processos/route');
    const res = await POST(post('http://x', { requisicao: 'Comprar 10 notebooks para TI' }));
    expect(res.status).toBe(200);
    expect(mod.criarProcesso).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' }),
    );
  });
});

describe('POST /api/fluxo/processos/[id]/decisao — o gate humano', () => {
  it('AJUSTAR sem dizer o motivo é recusado (a IA repetiria o mesmo resultado)', async () => {
    mockAuth(true);
    const mod = mockProcess();
    const { POST } = await import('@/app/api/fluxo/processos/[id]/decisao/route');

    const res = await POST(post('http://x', { decisao: 'ajustar', observacao: '   ' }), {
      params: { id: 'p1' },
    });

    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/o que precisa ser corrigido/i);
    expect(mod.decidirEtapa).not.toHaveBeenCalled();
  });

  it('SIGA não exige observação', async () => {
    mockAuth(true);
    const mod = mockProcess();
    const { POST } = await import('@/app/api/fluxo/processos/[id]/decisao/route');

    const res = await POST(post('http://x', { decisao: 'siga' }), { params: { id: 'p1' } });

    expect(res.status).toBe(200);
    expect(mod.decidirEtapa).toHaveBeenCalledWith(
      expect.objectContaining({ decisao: 'siga', userId: 'u1' }),
    );
  });

  it('recusa decisão fora do vocabulário do fluxo', async () => {
    mockAuth(true);
    mockProcess();
    const { POST } = await import('@/app/api/fluxo/processos/[id]/decisao/route');

    const res = await POST(post('http://x', { decisao: 'aprovar_tudo' }), {
      params: { id: 'p1' },
    });
    expect(res.status).toBe(400);
  });

  it('409 quando não há execução pendente', async () => {
    mockAuth(true);
    mockProcess({
      decidirEtapa: vi.fn().mockResolvedValue({ ok: false, reason: 'sem_pendencia' }),
    });
    const { POST } = await import('@/app/api/fluxo/processos/[id]/decisao/route');

    const res = await POST(post('http://x', { decisao: 'siga' }), { params: { id: 'p1' } });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/fluxo/processos/[id]/run', () => {
  it('respeita o rate limit do chat', async () => {
    mockAuth(true);
    mockProcess();
    vi.doMock('@/lib/rate-limit', () => ({
      checkChatRateLimit: vi.fn().mockResolvedValue({ allowed: false }),
    }));
    const { POST } = await import('@/app/api/fluxo/processos/[id]/run/route');

    const res = await POST(post('http://x', {}), { params: { id: 'p1' } });
    expect(res.status).toBe(429);
  });

  it('409 quando a etapa já aguarda decisão', async () => {
    mockAuth(true);
    mockProcess({ rodarEtapa: vi.fn().mockResolvedValue({ ok: false, reason: 'ja_pendente' }) });
    const { POST } = await import('@/app/api/fluxo/processos/[id]/run/route');

    const res = await POST(post('http://x', {}), { params: { id: 'p1' } });
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/aguarda sua decisão/i);
  });
});

// Painel de gestão dos processos (pedido de cliente, 24/09/2026).
describe('GET /api/fluxo/painel', () => {
  function mockDb(processos: unknown[], etapas: unknown[]) {
    const eqCalls: Array<[string, unknown]> = [];
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: (t: string) => ({
          select: () => ({
            eq: (col: string, val: unknown) => {
              eqCalls.push([col, val]);
              return Promise.resolve({
                data: t === 'fluxo_processos' ? processos : etapas,
              });
            },
          }),
        }),
      }),
    }));
    return eqCalls;
  }

  it('401 sem sessão', async () => {
    mockAuth(false);
    mockDb([], []);
    const { GET } = await import('@/app/api/fluxo/painel/route');
    expect((await GET()).status).toBe(401);
  });

  it('filtra as DUAS tabelas pelo usuário logado', async () => {
    mockAuth(true);
    const eqCalls = mockDb([], []);
    const { GET } = await import('@/app/api/fluxo/painel/route');
    await GET();

    // Sem este filtro em cada consulta, um comprador veria a compra do outro.
    expect(eqCalls).toEqual([
      ['user_id', 'u1'],
      ['user_id', 'u1'],
    ]);
  });

  it('devolve o painel montado a partir dos processos do usuário', async () => {
    mockAuth(true);
    mockDb(
      [
        {
          id: 'p1',
          user_id: 'u1',
          titulo: 'Notebooks',
          etapa_atual: 'rfq',
          status: 'em_andamento',
          contexto: {},
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
      [],
    );
    const { GET } = await import('@/app/api/fluxo/painel/route');
    const body = (await (await GET()).json()) as {
      emAndamento: number;
      etapas: Array<{ etapa: string; emAndamento: number }>;
    };

    expect(body.emAndamento).toBe(1);
    expect(body.etapas.find((e) => e.etapa === 'rfq')!.emAndamento).toBe(1);
  });
});
