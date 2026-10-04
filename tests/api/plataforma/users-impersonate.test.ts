import { describe, expect, it, vi, beforeEach } from 'vitest';

const recordAuditLog = vi.fn();

beforeEach(() => {
  vi.resetModules();
  recordAuditLog.mockReset();
  process.env.APP_URL = 'https://progpt.com.br';
});

function mockAuth(isSuperAdmin: boolean, userId = 'admin-1') {
  vi.doMock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>();
    return {
      ...actual,
      requireSuperAdmin: vi.fn().mockImplementation(async () => {
        if (!isSuperAdmin) throw new actual.NotSuperAdmin();
        return {
          user: { id: userId, email: 'staff@2bsupply.com.br' } as unknown,
          profile: { id: userId, role: 'admin', display_name: null, super_admin: true },
        };
      }),
    };
  });
  vi.doMock('@/lib/observability/audit-log', () => ({ recordAuditLog }));
}

type Target = { id: string; email: string; super_admin: boolean; banned_until: string | null } | null;

function mockDb(target: Target, link: { hashed_token?: string; error?: unknown } = { hashed_token: 'hash-123' }) {
  const generateLink = vi.fn().mockResolvedValue({
    data: link.hashed_token ? { properties: { hashed_token: link.hashed_token } } : null,
    error: link.error ?? null,
  });
  const maybeSingle = vi.fn().mockResolvedValue({ data: target, error: null });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
      auth: { admin: { generateLink } },
    }),
  }));
  return { generateLink };
}

const cliente: Target = { id: 'u2', email: 'cliente@empresa.com', super_admin: false, banned_until: null };

async function call(id: string) {
  const { POST } = await import('@/app/api/plataforma/users/[id]/impersonate/route');
  return POST(new Request('http://x', { method: 'POST' }), { params: { id } });
}

describe('POST /api/plataforma/users/[id]/impersonate', () => {
  it('404 para quem não é super admin (não revela o endpoint)', async () => {
    mockAuth(false);
    mockDb(cliente);
    expect((await call('u2')).status).toBe(404);
  });

  it('recusa entrar na própria conta', async () => {
    mockAuth(true, 'admin-1');
    const { generateLink } = mockDb(cliente);
    const res = await call('admin-1');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('cannot_impersonate_self');
    expect(generateLink).not.toHaveBeenCalled();
  });

  it('recusa entrar na conta de outro super admin', async () => {
    mockAuth(true);
    const { generateLink } = mockDb({ ...cliente!, super_admin: true });
    const res = await call('u2');
    expect(res.status).toBe(403);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it('recusa conta com login desativado', async () => {
    mockAuth(true);
    mockDb({ ...cliente!, banned_until: '2125-01-01T00:00:00Z' });
    expect((await call('u2')).status).toBe(409);
  });

  it('aceita conta cujo bloqueio já expirou', async () => {
    mockAuth(true);
    mockDb({ ...cliente!, banned_until: '2020-01-01T00:00:00Z' });
    expect((await call('u2')).status).toBe(200);
  });

  it('404 para usuário inexistente', async () => {
    mockAuth(true);
    mockDb(null);
    expect((await call('u9')).status).toBe(404);
  });

  it('gera link de uso único pelo /auth/confirm do PROGPT e registra na auditoria', async () => {
    mockAuth(true);
    const { generateLink } = mockDb(cliente);
    const res = await call('u2');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'cliente@empresa.com' });

    const { url } = (await res.json()) as { url: string };
    const u = new URL(url);
    expect(u.origin).toBe('https://progpt.com.br');
    expect(u.pathname).toBe('/auth/confirm');
    expect(u.searchParams.get('token_hash')).toBe('hash-123');
    expect(u.searchParams.get('type')).toBe('magiclink');
    expect(u.searchParams.get('next')).toBe('/chat');

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'user.impersonate',
        resourceId: 'u2',
        metadata: { targetEmail: 'cliente@empresa.com' },
      }),
    );
  });

  it('500 se o Supabase não gerar o link (e não audita acesso que não existiu)', async () => {
    mockAuth(true);
    mockDb(cliente, { error: new Error('boom') });
    expect((await call('u2')).status).toBe(500);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});
