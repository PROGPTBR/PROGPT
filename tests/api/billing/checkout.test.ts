import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(authed: boolean, userId = 'u1') {
  vi.doMock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>();
    return {
      ...actual,
      requireUser: vi.fn().mockImplementation(async () => {
        if (!authed) throw new (actual.NotAuthenticated)();
        return { id: userId, email: 'me@x.com' };
      }),
    };
  });
}

function mockBillingDeps(opts: {
  existing?: Record<string, unknown> | null;
  customerResult?: { id: string };
  subResult?: { id: string; invoiceUrl: string };
  customerThrows?: boolean;
  subThrows?: boolean;
}) {
  vi.doMock('@/lib/billing/subscription', () => ({
    getSubscription: vi.fn().mockResolvedValue(opts.existing ?? null),
  }));
  vi.doMock('@/lib/billing/asaas', () => ({
    createAsaasCustomer: vi.fn().mockImplementation(async () => {
      if (opts.customerThrows) throw new Error('asaas down');
      return opts.customerResult ?? { id: 'cus_x' };
    }),
    createAsaasSubscription: vi.fn().mockImplementation(async () => {
      if (opts.subThrows) throw new Error('asaas down');
      return opts.subResult ?? { id: 'sub_x', invoiceUrl: 'https://asaas/checkout' };
    }),
    AsaasError: class AsaasError extends Error {
      constructor(public msg: string, public status: number) {
        super(msg);
      }
    },
  }));
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({
        // profiles update: from('profiles').update({...}).eq('id', ...)
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        // subscriptions upsert
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }));
}

async function POST_with(body: unknown) {
  const { POST } = await import('@/app/api/billing/checkout/route');
  return POST(
    new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

describe('POST /api/billing/checkout', () => {
  it('401 when not authenticated', async () => {
    mockAuth(false);
    mockBillingDeps({});
    const res = await POST_with({ name: 'X', cpf: '12345678909' });
    expect(res.status).toBe(401);
  });

  it('400 when body is invalid', async () => {
    mockAuth(true);
    mockBillingDeps({});
    const res = await POST_with({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('400 when CPF is invalid', async () => {
    mockAuth(true);
    mockBillingDeps({});
    const res = await POST_with({ name: 'João Silva', cpf: '11111111111' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_cpf');
  });

  it('409 when user already has active subscription', async () => {
    mockAuth(true);
    mockBillingDeps({
      existing: {
        status: 'active',
        created_at: new Date().toISOString(),
        asaas_customer_id: 'cus_old',
        // 409 só dispara quando há subscription paga real no Asaas
        asaas_subscription_id: 'sub_old',
      },
    });
    const res = await POST_with({ name: 'João', cpf: '390.533.447-05' });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('already_subscribed');
  });

  it('409 when checkout already in progress (pending <1h)', async () => {
    mockAuth(true);
    mockBillingDeps({
      existing: {
        status: 'pending',
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        asaas_customer_id: 'cus_x',
        asaas_subscription_id: 'sub_x',
      },
    });
    const res = await POST_with({ name: 'João', cpf: '39053344705' });
    expect(res.status).toBe(409);
  });

  it('200 success + returns checkoutUrl', async () => {
    mockAuth(true);
    mockBillingDeps({});
    const res = await POST_with({ name: 'João Silva', cpf: '39053344705' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkoutUrl).toBe('https://asaas/checkout');
  });

  it('502 when Asaas createSubscription fails', async () => {
    mockAuth(true);
    mockBillingDeps({ subThrows: true });
    const res = await POST_with({ name: 'João', cpf: '39053344705' });
    expect(res.status).toBe(502);
  });
});
