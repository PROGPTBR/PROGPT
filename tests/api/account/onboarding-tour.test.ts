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
      return { id: 'user-1', email: 'cliente@empresa.com' };
    }),
  }));
}

function mockSupabase(error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ error });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({ from }),
  }));
  return { from, update, eq };
}

describe('POST /api/account/onboarding-tour', () => {
  it('401 sem sessão', async () => {
    mockAuth(false);
    mockSupabase();
    const { POST } = await import('@/app/api/account/onboarding-tour/route');
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('marca o tour como visto no perfil do próprio usuário', async () => {
    mockAuth(true);
    const sb = mockSupabase();
    const { POST } = await import('@/app/api/account/onboarding-tour/route');

    const res = await POST();

    expect(res.status).toBe(200);
    expect(sb.from).toHaveBeenCalledWith('profiles');
    // O filtro explícito é o que impede marcar o perfil de outra pessoa.
    expect(sb.eq).toHaveBeenCalledWith('id', 'user-1');

    const patch = sb.update.mock.calls[0][0] as { onboarding_tour_completed_at: string };
    expect(Number.isNaN(Date.parse(patch.onboarding_tour_completed_at))).toBe(false);
  });

  it('500 quando o banco recusa, sem derrubar a rota', async () => {
    mockAuth(true);
    mockSupabase({ message: 'boom' });
    const { POST } = await import('@/app/api/account/onboarding-tour/route');

    const res = await POST();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'update_failed' });
  });
});
