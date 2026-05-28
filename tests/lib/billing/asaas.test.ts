import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  process.env.ASAAS_API_KEY = 'test-key';
  process.env.ASAAS_API_URL = 'https://sandbox.asaas.com/api/v3';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createAsaasCustomer', () => {
  it('POSTs /customers with access_token + name/email/cpfCnpj', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'cus_1', name: 'X', email: 'x@y.com', cpfCnpj: '123' }), {
        status: 200,
      }),
    );
    const { createAsaasCustomer } = await import('@/lib/billing/asaas');
    const result = await createAsaasCustomer({
      name: 'Test',
      email: 't@t.com',
      cpfCnpj: '12345678909',
    });
    expect(result.id).toBe('cus_1');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://sandbox.asaas.com/api/v3/customers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ access_token: 'test-key' }),
      }),
    );
  });

  it('throws AsaasError on 4xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ code: 'invalid_cpfCnpj' }] }), { status: 400 }),
    );
    const { createAsaasCustomer, AsaasError } = await import('@/lib/billing/asaas');
    await expect(
      createAsaasCustomer({ name: 'X', email: 'x@y.com', cpfCnpj: 'bad' }),
    ).rejects.toBeInstanceOf(AsaasError);
  });

  it('throws when ASAAS_API_KEY is missing', async () => {
    delete process.env.ASAAS_API_KEY;
    const { createAsaasCustomer } = await import('@/lib/billing/asaas');
    await expect(
      createAsaasCustomer({ name: 'X', email: 'x@y.com', cpfCnpj: '12345678909' }),
    ).rejects.toThrow(/ASAAS_API_KEY/);
  });
});

describe('createAsaasSubscription', () => {
  it('POSTs /subscriptions and returns invoiceUrl', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'sub_1', invoiceUrl: 'https://asaas/checkout/abc' }),
        { status: 200 },
      ),
    );
    const { createAsaasSubscription } = await import('@/lib/billing/asaas');
    const result = await createAsaasSubscription({
      customerId: 'cus_1',
      value: 99,
      cycle: 'MONTHLY',
      billingType: 'UNDEFINED',
      description: 'Pro',
      nextDueDate: '2026-06-01',
    });
    expect(result.id).toBe('sub_1');
    expect(result.invoiceUrl).toBe('https://asaas/checkout/abc');
  });

  it('falls back to paymentLink when invoiceUrl is null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'sub_2', invoiceUrl: null, paymentLink: 'https://pay/x' }),
        { status: 200 },
      ),
    );
    const { createAsaasSubscription } = await import('@/lib/billing/asaas');
    const result = await createAsaasSubscription({
      customerId: 'cus_1',
      value: 99,
      cycle: 'MONTHLY',
      billingType: 'CREDIT_CARD',
      description: 'Pro',
      nextDueDate: '2026-06-01',
    });
    expect(result.invoiceUrl).toBe('https://pay/x');
  });
});

describe('cancelAsaasSubscription', () => {
  it('DELETEs /subscriptions/{id}', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 }),
    );
    const { cancelAsaasSubscription } = await import('@/lib/billing/asaas');
    await cancelAsaasSubscription('sub_1');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://sandbox.asaas.com/api/v3/subscriptions/sub_1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
