import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  process.env.ASAAS_WEBHOOK_TOKEN = 'wh-secret';
});

type Stubs = {
  eventInsertErr?: { code?: string; message?: string } | null;
  subLoad?: Record<string, unknown> | null;
  subUpdateErr?: { message: string } | null;
};

function mockSupabase(stubs: Stubs = {}) {
  const eventUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  const subUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: stubs.subUpdateErr ?? null }),
  });
  const builder = (table: string) => {
    if (table === 'billing_webhook_events') {
      return {
        insert: vi.fn().mockResolvedValue({ error: stubs.eventInsertErr ?? null }),
        update: eventUpdate,
      };
    }
    if (table === 'subscriptions') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: stubs.subLoad ?? null, error: null }),
          }),
        }),
        update: subUpdate,
      };
    }
    return {};
  };
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: vi.fn().mockImplementation(builder),
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: 'u1', email: 'user@example.com' } },
            error: null,
          }),
        },
      },
    }),
  }));
  // Email send é fire-and-forget — silenciar pra teste limpo
  vi.doMock('@/lib/email/client', () => ({
    sendEmail: vi.fn().mockResolvedValue({ ok: true, id: 'msg' }),
    getAppUrl: () => 'http://localhost',
  }));
  return { subUpdate, eventUpdate };
}

async function POST_with(body: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import('@/app/api/billing/webhook/asaas/route');
  return POST(
    new Request('http://localhost/api/billing/webhook/asaas', {
      method: 'POST',
      headers: { 'asaas-access-token': 'wh-secret', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

describe('POST /api/billing/webhook/asaas', () => {
  it('401 when access token is wrong', async () => {
    mockSupabase();
    const res = await POST_with(
      { id: 'evt_1', event: 'PAYMENT_CONFIRMED' },
      { 'asaas-access-token': 'wrong' },
    );
    expect(res.status).toBe(401);
  });

  it('400 when body is missing required fields', async () => {
    mockSupabase();
    const res = await POST_with({ id: 'evt_1' });
    expect(res.status).toBe(400);
  });

  it('200 dedupe when event_id already processed (unique violation)', async () => {
    mockSupabase({ eventInsertErr: { code: '23505' } });
    const res = await POST_with({
      id: 'evt_1',
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay', subscription: 'sub_x' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deduped).toBe(true);
  });

  it('200 skipped when event has no subscription_id', async () => {
    mockSupabase();
    const res = await POST_with({ id: 'evt_1', event: 'CUSTOMER_UPDATED' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
  });

  it('200 orphan when subscription not in our DB', async () => {
    mockSupabase({ subLoad: null });
    const res = await POST_with({
      id: 'evt_1',
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay', subscription: 'sub_ghost' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orphan).toBe(true);
  });

  it('updates status to active on PAYMENT_CONFIRMED', async () => {
    const { subUpdate } = mockSupabase({
      subLoad: { id: 's1', asaas_subscription_id: 'sub_x' },
    });
    const res = await POST_with({
      id: 'evt_1',
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay',
        subscription: 'sub_x',
        billingType: 'CREDIT_CARD',
        confirmedDate: '2026-05-27T00:00:00Z',
      },
    });
    expect(res.status).toBe(200);
    expect(subUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', payment_method: 'credit_card' }),
    );
  });

  it('updates status to past_due on PAYMENT_OVERDUE', async () => {
    const { subUpdate } = mockSupabase({
      subLoad: { id: 's1', asaas_subscription_id: 'sub_x' },
    });
    await POST_with({
      id: 'evt_1',
      event: 'PAYMENT_OVERDUE',
      payment: { id: 'pay', subscription: 'sub_x' },
    });
    expect(subUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'past_due' }),
    );
  });

  it('updates status to cancelled on SUBSCRIPTION_DELETED', async () => {
    const { subUpdate } = mockSupabase({
      subLoad: { id: 's1', asaas_subscription_id: 'sub_x' },
    });
    await POST_with({
      id: 'evt_1',
      event: 'SUBSCRIPTION_DELETED',
      subscription: { id: 'sub_x' },
    });
    expect(subUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' }),
    );
  });

  it('flags an unrecognized event as unhandled (no silent drop) and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { subUpdate } = mockSupabase({
      subLoad: { id: 's1', asaas_subscription_id: 'sub_x' },
    });
    const res = await POST_with({
      id: 'evt_1',
      event: 'PAYMENT_CHARGEBACK_REQUESTED', // real Asaas event we don't map
      payment: { id: 'pay', subscription: 'sub_x' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unhandled).toBe('PAYMENT_CHARGEBACK_REQUESTED');
    // must NOT touch subscription state for an event we don't understand
    expect(subUpdate).not.toHaveBeenCalled();
    // must be visible in logs (and Sentry once wired)
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays quiet for a known benign event (PAYMENT_CREATED)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockSupabase({ subLoad: { id: 's1', asaas_subscription_id: 'sub_x' } });
    const res = await POST_with({
      id: 'evt_1',
      event: 'PAYMENT_CREATED',
      payment: { id: 'pay', subscription: 'sub_x' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unhandled).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
