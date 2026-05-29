import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(authed: boolean, userId = 'user-1') {
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

function mockDeleteAndSignOut(
  deleteError: unknown = null,
  deleteSpy?: ReturnType<typeof vi.fn>,
) {
  const spy = deleteSpy ?? vi.fn().mockResolvedValue({ error: deleteError });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({ auth: { admin: { deleteUser: spy } } }),
  }));
  vi.doMock('@/lib/db/supabase-server', () => ({
    supabaseServer: () => ({
      auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
    }),
  }));
  return spy;
}

// Defaults to no subscription. Pass a partial subscription to simulate a
// paying user. `cancelErrorStatus` makes the Asaas cancel throw an
// AsaasError with that HTTP status — the class is owned by this mock so
// the route's `instanceof AsaasError` check sees the same class identity
// (resetModules would otherwise hand the route a different class).
function mockBilling(opts: {
  subscription?: Record<string, unknown> | null;
  cancelErrorStatus?: number;
} = {}) {
  const sub = opts.subscription === undefined ? null : opts.subscription;
  class AsaasError extends Error {
    constructor(msg: string, public status: number) {
      super(msg);
      this.name = 'AsaasError';
    }
  }
  const cancelSpy = vi.fn().mockImplementation(async () => {
    if (opts.cancelErrorStatus != null) {
      throw new AsaasError('cancel failed', opts.cancelErrorStatus);
    }
  });
  vi.doMock('@/lib/billing/subscription', () => ({
    getSubscription: vi.fn().mockResolvedValue(sub),
  }));
  vi.doMock('@/lib/billing/asaas', () => ({
    cancelAsaasSubscription: cancelSpy,
    AsaasError,
  }));
  return cancelSpy;
}

describe('POST /api/account/delete', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(false);
    mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'EXCLUIR' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is invalid', async () => {
    mockAuth(true);
    mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: '{not-json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when confirmation phrase does not match', async () => {
    mockAuth(true);
    mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'excluir' }), // lowercase
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('confirmation_mismatch');
  });

  it('calls auth.admin.deleteUser with the authed user id and returns 204', async () => {
    mockAuth(true, 'user-42');
    mockBilling();
    const spy = mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'EXCLUIR' }),
      }),
    );
    expect(res.status).toBe(204);
    expect(spy).toHaveBeenCalledWith('user-42');
  });

  it('returns 500 when deleteUser errors', async () => {
    mockAuth(true);
    mockBilling();
    mockDeleteAndSignOut({ message: 'boom' });
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'EXCLUIR' }),
      }),
    );
    expect(res.status).toBe(500);
  });

  it('cancels the Asaas subscription BEFORE deleting when the user is paying', async () => {
    mockAuth(true, 'user-99');
    const cancelSpy = mockBilling({
      subscription: { id: 'sub-row', asaas_subscription_id: 'asaas-123', status: 'active' },
    });
    const deleteSpy = mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'EXCLUIR' }),
      }),
    );
    expect(res.status).toBe(204);
    expect(cancelSpy).toHaveBeenCalledWith('asaas-123');
    // and the cancel must have happened before the destructive delete
    expect(cancelSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      deleteSpy.mock.invocationCallOrder[0]!,
    );
  });

  it('does NOT call Asaas when the user has no subscription', async () => {
    mockAuth(true);
    const cancelSpy = mockBilling({ subscription: null });
    mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'EXCLUIR' }),
      }),
    );
    expect(res.status).toBe(204);
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it('does NOT delete the account when Asaas cancel fails (avoids charging a deleted user)', async () => {
    mockAuth(true);
    const cancelSpy = mockBilling({
      subscription: { id: 'sub-row', asaas_subscription_id: 'asaas-123', status: 'active' },
      cancelErrorStatus: 500,
    });
    const deleteSpy = mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'EXCLUIR' }),
      }),
    );
    expect(res.status).toBe(502);
    expect(cancelSpy).toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('proceeds with delete when Asaas returns 404 (subscription already gone)', async () => {
    mockAuth(true);
    mockBilling({
      subscription: { id: 'sub-row', asaas_subscription_id: 'asaas-123', status: 'active' },
      cancelErrorStatus: 404,
    });
    const deleteSpy = mockDeleteAndSignOut();
    const { POST } = await import('@/app/api/account/delete/route');
    const res = await POST(
      new Request('http://localhost/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'EXCLUIR' }),
      }),
    );
    expect(res.status).toBe(204);
    expect(deleteSpy).toHaveBeenCalled();
  });
});
