import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockSupabaseServer(opts: {
  user?: { id: string; email: string } | null;
  profile?:
    | {
        id: string;
        role: 'user' | 'admin';
        display_name: string | null;
        super_admin?: boolean;
      }
    | null;
  profileError?: { message: string } | null;
}) {
  vi.doMock('@/lib/db/supabase-server', () => ({
    supabaseServer: () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: opts.user ?? null }, error: null }),
      },
      from: vi.fn().mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: opts.profile ?? null,
                error: opts.profileError ?? null,
              }),
          }),
        }),
      })),
    }),
  }));
}

describe('lib/auth', () => {
  it('getCurrentUser returns the user when session is valid', async () => {
    mockSupabaseServer({ user: { id: 'u1', email: 'a@b.com' } });
    const { getCurrentUser } = await import('@/lib/auth');
    const u = await getCurrentUser();
    expect(u?.id).toBe('u1');
  });

  it('getCurrentUser returns null when no session', async () => {
    mockSupabaseServer({ user: null });
    const { getCurrentUser } = await import('@/lib/auth');
    expect(await getCurrentUser()).toBeNull();
  });

  it('requireUser throws NotAuthenticated when no session', async () => {
    mockSupabaseServer({ user: null });
    const { requireUser, NotAuthenticated } = await import('@/lib/auth');
    await expect(requireUser()).rejects.toBeInstanceOf(NotAuthenticated);
  });

  it('getProfile returns the profile row when present', async () => {
    mockSupabaseServer({
      profile: { id: 'u1', role: 'user', display_name: null },
    });
    const { getProfile } = await import('@/lib/auth');
    const p = await getProfile('u1');
    expect(p?.role).toBe('user');
  });

  it('getProfile returns null on error or missing row', async () => {
    mockSupabaseServer({ profile: null, profileError: { message: 'not found' } });
    const { getProfile } = await import('@/lib/auth');
    expect(await getProfile('u1')).toBeNull();
  });

  it('requireAdmin returns user + profile when role is admin', async () => {
    mockSupabaseServer({
      user: { id: 'u1', email: 'a@b.com' },
      profile: { id: 'u1', role: 'admin', display_name: null },
    });
    const { requireAdmin } = await import('@/lib/auth');
    const { user, profile } = await requireAdmin();
    expect(user.id).toBe('u1');
    expect(profile.role).toBe('admin');
  });

  it('requireAdmin throws NotAdmin when role is user', async () => {
    mockSupabaseServer({
      user: { id: 'u1', email: 'a@b.com' },
      profile: { id: 'u1', role: 'user', display_name: null },
    });
    const { requireAdmin, NotAdmin } = await import('@/lib/auth');
    await expect(requireAdmin()).rejects.toBeInstanceOf(NotAdmin);
  });

  // Fundação "Plataforma" — super_admin é um flag GLOBAL ortogonal a `role`
  // (não um valor de role, ao contrário de admin/gestor).
  describe('isSuperAdmin / requireSuperAdmin', () => {
    it('isSuperAdmin returns false for null profile', async () => {
      const { isSuperAdmin } = await import('@/lib/auth');
      expect(isSuperAdmin(null)).toBe(false);
    });

    it('isSuperAdmin returns true only when super_admin === true', async () => {
      const { isSuperAdmin } = await import('@/lib/auth');
      expect(
        isSuperAdmin({
          id: 'u1',
          role: 'user',
          display_name: null,
          full_name: null,
          cpf_cnpj: null,
          phone: null,
          professional_requirement: null,
          plan: null,
          selected_plan: null,
          asaas_customer_id: null,
          asaas_subscription_id: null,
          subscription_status: null,
          org_id: 'org-1',
          super_admin: true,
        }),
      ).toBe(true);
    });

    it('requireSuperAdmin returns user + profile when super_admin is true, even for a non-admin role', async () => {
      mockSupabaseServer({
        user: { id: 'u1', email: 'a@b.com' },
        profile: { id: 'u1', role: 'user', display_name: null, super_admin: true },
      });
      const { requireSuperAdmin } = await import('@/lib/auth');
      const { user, profile } = await requireSuperAdmin();
      expect(user.id).toBe('u1');
      expect(profile.super_admin).toBe(true);
    });

    it('requireSuperAdmin throws NotSuperAdmin when super_admin is false, even for role=admin', async () => {
      mockSupabaseServer({
        user: { id: 'u1', email: 'a@b.com' },
        profile: { id: 'u1', role: 'admin', display_name: null, super_admin: false },
      });
      const { requireSuperAdmin, NotSuperAdmin } = await import('@/lib/auth');
      await expect(requireSuperAdmin()).rejects.toBeInstanceOf(NotSuperAdmin);
    });
  });
});
