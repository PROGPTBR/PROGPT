import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

class NotAuthenticated extends Error {}

function mockBase(opts: { authed?: boolean; liberado?: boolean; rateOk?: boolean } = {}) {
  const { authed = true, liberado = true, rateOk = true } = opts;
  vi.doMock('@/lib/fluxo/acesso-servidor', async () => {
    const { NextResponse } = await import('next/server');
    return {
      usuarioComFluxo: vi.fn().mockResolvedValue(liberado),
      respostaSobDemanda: () => NextResponse.json({ error: 'sob_demanda' }, { status: 403 }),
    };
  });
  vi.doMock('@/lib/auth', () => ({
    NotAuthenticated,
    requireUser: vi.fn().mockImplementation(async () => {
      if (!authed) throw new NotAuthenticated();
      return { id: 'u1', email: 'comprador@empresa.com' };
    }),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkAnonRateLimit: vi.fn().mockResolvedValue(rateOk ? { allowed: true } : { allowed: false, retryAfterSecs: 30 }),
  }));
  vi.doMock('@/lib/captcha', () => ({ getClientIp: () => '1.2.3.4', hashIp: () => 'hash' }));
}

function mockAcompanhamento(over: Record<string, unknown> = {}) {
  const mod = {
    decidirAprovacao: vi.fn().mockResolvedValue({ ok: true, aprovado: true }),
    pedirAprovacao: vi.fn().mockResolvedValue({ ok: true, aprovacao: { id: 'a1' }, enviado: true }),
    listarAprovacoes: vi.fn().mockResolvedValue([]),
    cancelarAprovacoesPendentes: vi.fn().mockResolvedValue(undefined),
    configurarAcompanhamento: vi.fn().mockResolvedValue({ ok: true, link: 'https://x/acompanhar/t', processo: { id: 'p1' }, enviado: false }),
    ...over,
  };
  vi.doMock('@/lib/fluxo/acompanhamento', () => mod);
  return mod;
}

const json = (body: unknown) =>
  new Request('http://localhost/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /api/fluxo/aprovar/[token] (pública, gestor sem conta)', () => {
  it('aprova sem login e repassa a decisão', async () => {
    mockBase({ authed: false });
    const mod = mockAcompanhamento();
    const { POST } = await import('@/app/api/fluxo/aprovar/[token]/route');
    const res = await POST(json({ decisao: 'aprovar' }), { params: { token: 'tok' } });
    expect(res.status).toBe(200);
    expect(mod.decidirAprovacao).toHaveBeenCalledWith({ token: 'tok', aprovado: true, comentario: '' });
  });

  it('reprovar sem motivo vira 400; pedido fechado vira 409', async () => {
    mockBase();
    mockAcompanhamento({ decidirAprovacao: vi.fn().mockResolvedValue({ ok: false, reason: 'sem_motivo' }) });
    let { POST } = await import('@/app/api/fluxo/aprovar/[token]/route');
    expect((await POST(json({ decisao: 'reprovar' }), { params: { token: 't' } })).status).toBe(400);

    vi.resetModules();
    mockBase();
    mockAcompanhamento({ decidirAprovacao: vi.fn().mockResolvedValue({ ok: false, reason: 'indisponivel', estado: 'aprovado' }) });
    ({ POST } = await import('@/app/api/fluxo/aprovar/[token]/route'));
    const res = await POST(json({ decisao: 'aprovar' }), { params: { token: 't' } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ estado: 'aprovado' });
  });

  it('limita tentativas por IP', async () => {
    mockBase({ rateOk: false });
    const mod = mockAcompanhamento();
    const { POST } = await import('@/app/api/fluxo/aprovar/[token]/route');
    expect((await POST(json({ decisao: 'aprovar' }), { params: { token: 't' } })).status).toBe(429);
    expect(mod.decidirAprovacao).not.toHaveBeenCalled();
  });

  it('decisão desconhecida é 400', async () => {
    mockBase();
    mockAcompanhamento();
    const { POST } = await import('@/app/api/fluxo/aprovar/[token]/route');
    expect((await POST(json({ decisao: 'talvez' }), { params: { token: 't' } })).status).toBe(400);
  });
});

describe('/api/fluxo/processos/[id]/aprovacao (comprador)', () => {
  it('exige login e Fluxo liberado', async () => {
    mockBase({ authed: false });
    mockAcompanhamento();
    let { POST } = await import('@/app/api/fluxo/processos/[id]/aprovacao/route');
    expect((await POST(json({ aprovadorEmail: 'g@e.com' }), { params: { id: 'p1' } })).status).toBe(401);

    vi.resetModules();
    mockBase({ liberado: false });
    const mod = mockAcompanhamento();
    ({ POST } = await import('@/app/api/fluxo/processos/[id]/aprovacao/route'));
    expect((await POST(json({ aprovadorEmail: 'g@e.com' }), { params: { id: 'p1' } })).status).toBe(403);
    expect(mod.pedirAprovacao).not.toHaveBeenCalled();
  });

  it('pede a aprovação para o usuário logado', async () => {
    mockBase();
    const mod = mockAcompanhamento();
    const { POST } = await import('@/app/api/fluxo/processos/[id]/aprovacao/route');
    const res = await POST(json({ aprovadorNome: 'Gil', aprovadorEmail: 'g@e.com' }), { params: { id: 'p1' } });
    expect(res.status).toBe(200);
    expect(mod.pedirAprovacao).toHaveBeenCalledWith({ userId: 'u1', processoId: 'p1', aprovadorNome: 'Gil', aprovadorEmail: 'g@e.com' });
  });

  it('sem etapa aguardando decisão é 409', async () => {
    mockBase();
    mockAcompanhamento({ pedirAprovacao: vi.fn().mockResolvedValue({ ok: false, reason: 'sem_pendencia' }) });
    const { POST } = await import('@/app/api/fluxo/processos/[id]/aprovacao/route');
    expect((await POST(json({ aprovadorEmail: 'g@e.com' }), { params: { id: 'p1' } })).status).toBe(409);
  });
});

describe('POST /api/fluxo/processos/[id]/acompanhamento', () => {
  it('e-mail inválido é 400 e o Fluxo sob demanda é 403', async () => {
    mockBase();
    mockAcompanhamento({ configurarAcompanhamento: vi.fn().mockResolvedValue({ ok: false, reason: 'email_invalido' }) });
    let { POST } = await import('@/app/api/fluxo/processos/[id]/acompanhamento/route');
    expect((await POST(json({ solicitanteEmail: 'x', enviar: true }), { params: { id: 'p1' } })).status).toBe(400);

    vi.resetModules();
    mockBase({ liberado: false });
    mockAcompanhamento();
    ({ POST } = await import('@/app/api/fluxo/processos/[id]/acompanhamento/route'));
    expect((await POST(json({}), { params: { id: 'p1' } })).status).toBe(403);
  });
});
