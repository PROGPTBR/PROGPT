import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

class AsaasError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
    public description: string | null = null,
  ) {
    super(message);
    this.name = 'AsaasError';
  }
}

// Cliente reclamou (WhatsApp, 2026-09-14) que o cadastro com Mastercard "dá
// uma falha" sem entender o motivo. Causa: quando o Asaas recusa a criação
// da assinatura (cartão inválido/recusado), a rota devolvia
// `err.message` genérico ("Asaas POST /subscriptions failed: 400") em vez
// da descrição real que o Asaas já manda em `errors[0].description`, e o
// client mostrava isso via `alert()` cru. Este teste cobre só o desfecho
// dessa mudança — o resto do fluxo (signUp, createAsaasCustomer, profile
// update) precisa estar mockado até chegar em createAsaasSubscription.
function mockHappyPathUpToSubscription(opts: {
  subscriptionThrows?: Error;
}) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  vi.doMock('@/lib/captcha', () => ({
    verifyTurnstileToken: vi.fn().mockResolvedValue(true),
    getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  }));

  const authAdmin = { deleteUser: vi.fn().mockResolvedValue({ error: null }) };
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      auth: { admin: authAdmin },
      from: () => ({
        update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        upsert,
      }),
    }),
    getSignupSupabase: () => ({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: 'u1' } },
          error: null,
        }),
      },
    }),
  }));

  vi.doMock('@/lib/billing/settings', () => ({
    getBillingSettings: vi.fn().mockResolvedValue({
      apiKey: 'k',
      apiUrl: 'https://sandbox.asaas.com/api/v3',
      planPrice: 73,
      trialDays: 3,
    }),
  }));

  vi.doMock('@/lib/validators/cpf', () => ({
    isValidCpf: vi.fn().mockReturnValue(true),
    formatCpf: vi.fn().mockImplementation((v: string) => v),
  }));

  vi.doMock('@/lib/billing/asaas', () => ({
    AsaasError,
    createAsaasCustomer: vi.fn().mockResolvedValue({ id: 'cus_1' }),
    deleteAsaasCustomer: vi.fn().mockResolvedValue(undefined),
    createAsaasSubscription: vi.fn().mockImplementation(async () => {
      if (opts.subscriptionThrows) throw opts.subscriptionThrows;
      return { id: 'sub_1', invoiceUrl: '' };
    }),
  }));

  return { authAdmin, upsert };
}

function buildReq(extra: Record<string, unknown> = {}): Request {
  return new Request('http://x/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      turnstileToken: 'tok',
      email: 'kelly@empresa.com',
      password: 'senha1234',
      fullName: 'Kelly Silva',
      cpf: '12345678909',
      phone: '21999999999',
      companyName: 'Empresa X',
      postalCode: '20000-000',
      addressNumber: '10',
      cardHolder: 'KELLY SILVA',
      cardNumber: '5555 5555 5555 4444',
      cardExpiry: '12/30',
      cardCvv: '123',
      ...extra,
    }),
  });
}

describe('POST /api/signup — Asaas decline surfacing', () => {
  it('returns the real Asaas description (not the generic status message) when the card is declined', async () => {
    mockHappyPathUpToSubscription({
      subscriptionThrows: new AsaasError(
        'Asaas POST /subscriptions failed: 400',
        400,
        { errors: [{ code: 'invalid_creditCard', description: 'Cartão de crédito recusado' }] },
        'Cartão de crédito recusado',
      ),
    });
    const { POST } = await import('@/app/api/signup/route');
    const res = await POST(buildReq());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Cartão de crédito recusado');
  });

  it('falls back to a friendly generic message when Asaas gives no description', async () => {
    mockHappyPathUpToSubscription({
      subscriptionThrows: new AsaasError('Asaas POST /subscriptions failed: 500', 500, {}, null),
    });
    const { POST } = await import('@/app/api/signup/route');
    const res = await POST(buildReq());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/não foi possível processar o pagamento/i);
  });

  it('still returns 500 with the raw message for a non-Asaas error', async () => {
    mockHappyPathUpToSubscription({ subscriptionThrows: new Error('conexão perdida') });
    const { POST } = await import('@/app/api/signup/route');
    const res = await POST(buildReq());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('conexão perdida');
  });

  it('rolls back the Asaas customer and the auth user on decline', async () => {
    const { authAdmin } = mockHappyPathUpToSubscription({
      subscriptionThrows: new AsaasError('failed', 400, {}, 'Cartão recusado'),
    });
    const { createAsaasCustomer, deleteAsaasCustomer } = await import('@/lib/billing/asaas');
    const { POST } = await import('@/app/api/signup/route');
    await POST(buildReq());
    expect(createAsaasCustomer).toHaveBeenCalled();
    expect(deleteAsaasCustomer).toHaveBeenCalledWith('cus_1');
    expect(authAdmin.deleteUser).toHaveBeenCalledWith('u1');
  });
});

// Assinatura por usuário (2026-09-17). A demanda que originou isto: uma
// empresa contratando 3 acessos precisa ser cobrada em 3 × R$ 73 — e o
// cliente escolhe a QUANTIDADE, nunca o valor (o unitário vem do painel).
describe('POST /api/signup — assinatura por usuário (seats)', () => {
  it('charges the unit price when no seat count is sent (comportamento de antes)', async () => {
    mockHappyPathUpToSubscription({});
    const { createAsaasSubscription } = await import('@/lib/billing/asaas');
    const { POST } = await import('@/app/api/signup/route');

    const res = await POST(buildReq());

    expect(res.status).toBe(200);
    expect(createAsaasSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ value: 73 }),
    );
  });

  it('multiplies the charged value by the number of seats', async () => {
    mockHappyPathUpToSubscription({});
    const { createAsaasSubscription } = await import('@/lib/billing/asaas');
    const { POST } = await import('@/app/api/signup/route');

    await POST(buildReq({ seats: 3 }));

    const call = vi.mocked(createAsaasSubscription).mock.calls[0]![0];
    expect(call.value).toBe(219);
    // A description é o texto que aparece na fatura do cartão do cliente.
    expect(call.description).toContain('3 usuários');
  });

  it('persists seats and the informed extra emails on the local subscription row', async () => {
    const { upsert } = mockHappyPathUpToSubscription({});
    const { POST } = await import('@/app/api/signup/route');

    await POST(
      buildReq({
        seats: 3,
        seatEmails: [' Maria@Empresa.com ', 'joao@empresa.com', 'sobra@empresa.com'],
      }),
    );

    const row = upsert.mock.calls.at(-1)![0] as {
      seats: number;
      seat_emails: string[];
    };
    expect(row.seats).toBe(3);
    // Só os 2 acessos ADICIONAIS — o titular ocupa o primeiro.
    expect(row.seat_emails).toEqual(['maria@empresa.com', 'joao@empresa.com']);
  });

  it('never blocks the signup because of a bad seat count or bad emails', async () => {
    mockHappyPathUpToSubscription({});
    const { createAsaasSubscription } = await import('@/lib/billing/asaas');
    const { POST } = await import('@/app/api/signup/route');

    const res = await POST(
      buildReq({ seats: 'três', seatEmails: ['não-é-email'] }),
    );

    expect(res.status).toBe(200);
    expect(createAsaasSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ value: 73 }),
    );
  });
});
