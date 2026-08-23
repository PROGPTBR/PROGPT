import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

// Backlog do diretor 2026-08-23 — alerta de consumo: sinaliza no
// /admin/monitor quando o custo real de IA de um cliente pago (>= 70% do
// preço do plano, prorrateado pra janela selecionada) se aproxima do valor
// que ele paga. Este teste exercita só o cálculo do alerta — o resto da
// rota (atividade por dia/sessão) já não tinha cobertura antes.

type Opts = {
  isStaff?: boolean;
  profiles?: Array<Record<string, unknown>>;
  subscriptions?: Array<Record<string, unknown>>;
  planPrice?: number | null;
  events?: Array<Record<string, unknown>>;
};

// Query builder chainable pra `fetchSince` (sessions/assistant_runs/
// api_usage_events): .select().gte().order().range() resolve {data, error}.
function fetchSinceChain(rows: Array<Record<string, unknown>>) {
  const range = vi.fn().mockResolvedValue({ data: rows, error: null });
  const order = vi.fn().mockReturnValue({ range });
  const gte = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ gte });
  return { select };
}

function setupMocks(opts: Opts = {}) {
  vi.doMock('@/lib/auth', () => {
    class NotStaff extends Error {}
    class NotAuthenticated extends Error {}
    return {
      requireStaff: vi.fn().mockImplementation(() => {
        if (opts.isStaff === false) throw new NotStaff();
      }),
      NotStaff,
      NotAuthenticated,
    };
  });

  const profilesChain = { select: vi.fn().mockResolvedValue({ data: opts.profiles ?? [] }) };
  const subsChain = { select: vi.fn().mockResolvedValue({ data: opts.subscriptions ?? [] }) };
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: opts.planPrice != null ? { plan_price: opts.planPrice } : null });
  const billingChain = { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) };
  const emptyChain = fetchSinceChain([]);
  const eventsChain = fetchSinceChain(opts.events ?? []);

  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: (table: string) => {
        if (table === 'profiles_with_email') return profilesChain;
        if (table === 'subscriptions') return subsChain;
        if (table === 'billing_settings') return billingChain;
        if (table === 'api_usage_events') return eventsChain;
        return emptyChain; // sessions, assistant_runs
      },
    }),
  }));
}

function buildGet(url = 'http://x/api/admin/monitor?range=30'): Request {
  return new Request(url, { method: 'GET' });
}

describe('GET /api/admin/monitor — alerta de consumo', () => {
  it('returns 404 for non-staff', async () => {
    setupMocks({ isStaff: false });
    const { GET } = await import('@/app/api/admin/monitor/route');
    const res = await GET(buildGet());
    expect(res.status).toBe(404);
  });

  it('flags a paying user whose real cost already crossed 70% of the plan price', async () => {
    // R$ 73/mês, câmbio fixo ~5.30 → prorated 30d = 7300 cents BRL.
    // Um evento de US$ 10 (1000 cents) → BRL ≈ 5300 cents ≈ 72% do plano.
    setupMocks({
      isStaff: true,
      profiles: [{ id: 'u-1', email: 'cliente@x.com', role: 'user' }],
      subscriptions: [{ user_id: 'u-1', status: 'active', plan: 'pro' }],
      planPrice: 73,
      events: [
        {
          user_id: 'u-1',
          cost_usd_cents: 1000,
          tokens_in: 1000,
          tokens_out: 100,
          metadata: {},
          created_at: '2026-08-20T10:00:00Z',
        },
      ],
    });
    const { GET } = await import('@/app/api/admin/monitor/route');
    const res = await GET(buildGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.consumptionAlerts.thresholdPct).toBe(70);
    expect(body.consumptionAlerts.users).toHaveLength(1);
    expect(body.consumptionAlerts.users[0].userId).toBe('u-1');
    expect(body.consumptionAlerts.users[0].pctOfPlan).toBeGreaterThanOrEqual(70);

    const userRow = body.users.find((u: { userId: string }) => u.userId === 'u-1');
    expect(userRow.alert).toBe(true);
  });

  it('does not flag a paying user well under the threshold', async () => {
    setupMocks({
      isStaff: true,
      profiles: [{ id: 'u-2', email: 'leve@x.com', role: 'user' }],
      subscriptions: [{ user_id: 'u-2', status: 'active', plan: 'pro' }],
      planPrice: 73,
      events: [
        {
          user_id: 'u-2',
          cost_usd_cents: 50,
          tokens_in: 100,
          tokens_out: 10,
          metadata: {},
          created_at: '2026-08-20T10:00:00Z',
        },
      ],
    });
    const { GET } = await import('@/app/api/admin/monitor/route');
    const res = await GET(buildGet());
    const body = await res.json();
    expect(body.consumptionAlerts.users).toHaveLength(0);
    const userRow = body.users.find((u: { userId: string }) => u.userId === 'u-2');
    expect(userRow.alert).toBe(false);
    expect(userRow.pctOfPlan).toBeLessThan(70);
  });

  it('never flags a user without an active/trialing/past_due subscription, no matter the spend', async () => {
    setupMocks({
      isStaff: true,
      profiles: [{ id: 'u-3', email: 'sempagar@x.com', role: 'user' }],
      subscriptions: [{ user_id: 'u-3', status: 'cancelled', plan: 'pro' }],
      planPrice: 73,
      events: [
        {
          user_id: 'u-3',
          cost_usd_cents: 100_000, // gasto gigantesco — não importa, sem assinatura paga
          tokens_in: 1,
          tokens_out: 1,
          metadata: {},
          created_at: '2026-08-20T10:00:00Z',
        },
      ],
    });
    const { GET } = await import('@/app/api/admin/monitor/route');
    const res = await GET(buildGet());
    const body = await res.json();
    expect(body.consumptionAlerts.users).toHaveLength(0);
    const userRow = body.users.find((u: { userId: string }) => u.userId === 'u-3');
    expect(userRow.alert).toBe(false);
    expect(userRow.pctOfPlan).toBeNull();
  });

  it('prorates the plan price to the selected range (1 day ≈ 1/30 of the monthly price)', async () => {
    // Mesmo gasto do 1º teste (US$10 ≈ 72% de 30 dias), mas numa janela de
    // 1 dia o preço prorrateado cai pra ~R$2,43 — qualquer gasto real de IA
    // estoura isso, então o alerta deve disparar com folga maior ainda.
    setupMocks({
      isStaff: true,
      profiles: [{ id: 'u-4', email: 'hoje@x.com', role: 'user' }],
      subscriptions: [{ user_id: 'u-4', status: 'trialing', plan: 'pro' }],
      planPrice: 73,
      events: [
        {
          user_id: 'u-4',
          cost_usd_cents: 100,
          tokens_in: 100,
          tokens_out: 10,
          metadata: {},
          created_at: '2026-08-23T10:00:00Z',
        },
      ],
    });
    const { GET } = await import('@/app/api/admin/monitor/route');
    const res = await GET(buildGet('http://x/api/admin/monitor?range=1'));
    const body = await res.json();
    const userRow = body.users.find((u: { userId: string }) => u.userId === 'u-4');
    expect(userRow.pctOfPlan).toBeGreaterThan(70);
  });
});
