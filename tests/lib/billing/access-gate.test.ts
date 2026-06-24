import { describe, expect, it, vi, beforeEach } from 'vitest';

// Sub-projeto 36.1 — gate de cadastro de cartão pra novos usuários.
// Testa o grandfathering (contas antigas passam sem cartão) + os caminhos de
// acesso (admin, assinatura/trial válidos).

type Row = Record<string, unknown> | null;

function mockSupabase(rows: { profiles?: Row; subscriptions?: Row }) {
  return {
    from: (table: 'profiles' | 'subscriptions') => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        }),
      }),
    }),
  };
}

const getServerSupabase = vi.fn();
vi.mock('@/lib/db/supabase', () => ({
  getServerSupabase: () => getServerSupabase(),
}));

beforeEach(() => {
  vi.resetModules();
  getServerSupabase.mockReset();
});

describe('isGrandfathered', () => {
  it('libera contas criadas antes do cutoff', async () => {
    const { isGrandfathered } = await import('@/lib/billing/subscription');
    expect(isGrandfathered('2020-01-01T00:00:00Z')).toBe(true);
  });

  it('exige cartão pra contas criadas depois do cutoff', async () => {
    const { isGrandfathered } = await import('@/lib/billing/subscription');
    expect(isGrandfathered('2030-01-01T00:00:00Z')).toBe(false);
  });

  it('trata createdAt ausente/ inválido como não-grandfathered', async () => {
    const { isGrandfathered } = await import('@/lib/billing/subscription');
    expect(isGrandfathered(null)).toBe(false);
    expect(isGrandfathered(undefined)).toBe(false);
    expect(isGrandfathered('não é data')).toBe(false);
  });
});

describe('hasAccess', () => {
  it('grandfathered → acesso sem tocar no banco', async () => {
    const { hasAccess } = await import('@/lib/billing/subscription');
    expect(await hasAccess('u1', '2020-01-01T00:00:00Z')).toBe(true);
    expect(getServerSupabase).not.toHaveBeenCalled();
  });

  it('admin → acesso mesmo sem assinatura', async () => {
    getServerSupabase.mockReturnValue(
      mockSupabase({ profiles: { role: 'admin' } }),
    );
    const { hasAccess } = await import('@/lib/billing/subscription');
    expect(await hasAccess('u2', '2030-01-01T00:00:00Z')).toBe(true);
  });

  it('novo usuário sem assinatura → bloqueado', async () => {
    getServerSupabase.mockReturnValue(
      mockSupabase({ profiles: { role: 'user' }, subscriptions: null }),
    );
    const { hasAccess } = await import('@/lib/billing/subscription');
    expect(await hasAccess('u3', '2030-01-01T00:00:00Z')).toBe(false);
  });

  it('novo usuário em trial válido → acesso', async () => {
    getServerSupabase.mockReturnValue(
      mockSupabase({
        profiles: { role: 'user' },
        subscriptions: {
          status: 'trialing',
          trial_end: '2099-01-01T00:00:00Z',
          current_period_end: null,
        },
      }),
    );
    const { hasAccess } = await import('@/lib/billing/subscription');
    expect(await hasAccess('u4', '2030-01-01T00:00:00Z')).toBe(true);
  });

  it('novo usuário com trial expirado → bloqueado', async () => {
    getServerSupabase.mockReturnValue(
      mockSupabase({
        profiles: { role: 'user' },
        subscriptions: {
          status: 'trialing',
          trial_end: '2000-01-01T00:00:00Z',
          current_period_end: null,
        },
      }),
    );
    const { hasAccess } = await import('@/lib/billing/subscription');
    expect(await hasAccess('u5', '2030-01-01T00:00:00Z')).toBe(false);
  });
});
