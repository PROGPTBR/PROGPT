import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

// Licenças de uma assinatura (sub-projeto 64). O que estes testes protegem:
// o acesso extra não pode ser criado além do que foi PAGO, não pode ser
// revogado por outro titular, e aceitar convite de quem já tem conta não
// pode mexer na senha dessa pessoa.

type Result = { data?: unknown; error?: unknown };

/** Builder encadeável e "thenable": cobre tanto `await q.maybeSingle()`
 *  quanto `await q.order(...)`, que é como o código real consulta. */
function chain(result: Result) {
  const calls: Array<[string, unknown[]]> = [];
  const q: Record<string, unknown> = {
    __calls: calls,
    then: (resolve: (v: Result) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const m of ['select', 'eq', 'is', 'order', 'insert', 'update', 'maybeSingle', 'limit']) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return q;
    };
  }
  return q;
}

function mockDb(opts: {
  subscription?: { id: string; seats: number } | null;
  members?: Array<Record<string, unknown>>;
  insertResult?: Result;
  updateResult?: Result;
  seatByToken?: Record<string, unknown> | null;
  ownerProfile?: Record<string, unknown> | null;
  existingUserId?: string | null;
  createUserResult?: Result & { data?: { user: { id: string } | null } };
}) {
  const createUser = vi.fn().mockResolvedValue(
    opts.createUserResult ?? { data: { user: { id: 'new-user' } }, error: null },
  );
  const seatChains: Record<string, unknown>[] = [];

  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      auth: { admin: { createUser } },
      rpc: vi.fn().mockResolvedValue({ data: opts.existingUserId ?? null, error: null }),
      from: (table: string) => {
        if (table === 'subscriptions') {
          return chain({ data: opts.subscription ?? null, error: null });
        }
        if (table === 'profiles_with_email') {
          return chain({ data: opts.ownerProfile ?? null, error: null });
        }
        if (table === 'profiles') {
          return chain({ data: null, error: null });
        }
        // subscription_seats: o resultado depende da operação, então
        // devolvemos um builder que já sabe o que responder.
        const c = chain({ data: null, error: null }) as Record<string, unknown>;
        const calls = c.__calls as Array<[string, unknown[]]>;
        (c as { then: unknown }).then = (resolve: (v: Result) => unknown) => {
          const ops = calls.map(([m]) => m);
          let out: Result = { data: opts.members ?? [], error: null };
          if (ops.includes('insert')) out = opts.insertResult ?? { data: null, error: null };
          else if (ops.includes('update')) out = opts.updateResult ?? { data: null, error: null };
          else if (calls.some(([m, a]) => m === 'eq' && a[0] === 'invite_token')) {
            out = { data: opts.seatByToken ?? null, error: null };
          }
          return Promise.resolve(out).then(resolve);
        };
        seatChains.push(c);
        return c;
      },
    }),
  }));

  vi.doMock('@/lib/email/client', () => ({
    sendEmail: vi.fn().mockResolvedValue({ ok: true }),
  }));

  return { createUser, seatChains };
}

describe('getSeatState', () => {
  it('reserves one seat for the account holder', async () => {
    mockDb({ subscription: { id: 'sub-1', seats: 3 }, members: [] });
    const { getSeatState } = await import('@/lib/billing/seat-members');
    const state = await getSeatState('owner-1');
    expect(state.seats).toBe(3);
    expect(state.extraSeats).toBe(2); // titular ocupa 1
    expect(state.available).toBe(2);
  });

  it('counts pending invites against the available seats', async () => {
    mockDb({
      subscription: { id: 'sub-1', seats: 3 },
      members: [{ id: 's1', email: 'a@x.com', accepted_at: null, revoked_at: null }],
    });
    const { getSeatState } = await import('@/lib/billing/seat-members');
    const state = await getSeatState('owner-1');
    expect(state.used).toBe(1);
    expect(state.available).toBe(1);
  });

  it('reports no seats when there is no subscription', async () => {
    mockDb({ subscription: null });
    const { getSeatState } = await import('@/lib/billing/seat-members');
    const state = await getSeatState('owner-1');
    expect(state.available).toBe(0);
    expect(state.subscriptionId).toBeNull();
  });
});

describe('inviteSeat', () => {
  it('refuses once every paid seat is taken', async () => {
    mockDb({
      subscription: { id: 'sub-1', seats: 2 },
      members: [{ id: 's1', email: 'a@x.com', accepted_at: null, revoked_at: null }],
    });
    const { inviteSeat } = await import('@/lib/billing/seat-members');
    const res = await inviteSeat({ ownerId: 'o1', ownerEmail: 'o@x.com', email: 'b@x.com' });
    expect(res).toEqual({ ok: false, reason: 'no_seats_available' });
  });

  it('refuses the holder inviting their own email', async () => {
    mockDb({ subscription: { id: 'sub-1', seats: 3 } });
    const { inviteSeat } = await import('@/lib/billing/seat-members');
    const res = await inviteSeat({ ownerId: 'o1', ownerEmail: 'O@x.com', email: ' o@X.com ' });
    expect(res).toEqual({ ok: false, reason: 'self' });
  });

  it('refuses a duplicate invite for the same email', async () => {
    mockDb({
      subscription: { id: 'sub-1', seats: 5 },
      members: [{ id: 's1', email: 'a@x.com', accepted_at: null, revoked_at: null }],
    });
    const { inviteSeat } = await import('@/lib/billing/seat-members');
    const res = await inviteSeat({ ownerId: 'o1', ownerEmail: 'o@x.com', email: 'A@X.com' });
    expect(res).toEqual({ ok: false, reason: 'already_invited' });
  });

  it('refuses garbage emails', async () => {
    mockDb({ subscription: { id: 'sub-1', seats: 3 } });
    const { inviteSeat } = await import('@/lib/billing/seat-members');
    const res = await inviteSeat({ ownerId: 'o1', ownerEmail: 'o@x.com', email: 'sem-arroba' });
    expect(res).toEqual({ ok: false, reason: 'invalid_email' });
  });

  it('creates the seat with a token when there is room', async () => {
    mockDb({
      subscription: { id: 'sub-1', seats: 3 },
      members: [],
      insertResult: {
        data: { id: 's9', email: 'b@x.com', member_id: null, accepted_at: null, revoked_at: null },
        error: null,
      },
    });
    const { inviteSeat } = await import('@/lib/billing/seat-members');
    const res = await inviteSeat({ ownerId: 'o1', ownerEmail: 'o@x.com', email: ' B@X.com ' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.seat.email).toBe('b@x.com');
      expect(res.token.length).toBeGreaterThan(20);
    }
  });
});

describe('revokeSeat', () => {
  it('scopes the update to the owner so nobody revokes another subscription', async () => {
    const { seatChains } = mockDb({ updateResult: { data: { id: 's1' }, error: null } });
    const { revokeSeat } = await import('@/lib/billing/seat-members');
    const ok = await revokeSeat('owner-1', 's1');
    expect(ok).toBe(true);

    const calls = seatChains[0]!.__calls as Array<[string, unknown[]]>;
    expect(calls).toContainEqual(['eq', ['owner_id', 'owner-1']]);
  });

  it('returns false when nothing matched', async () => {
    mockDb({ updateResult: { data: null, error: null } });
    const { revokeSeat } = await import('@/lib/billing/seat-members');
    expect(await revokeSeat('owner-1', 'other')).toBe(false);
  });
});

describe('acceptInvite', () => {
  const pendingSeat = {
    id: 's1',
    email: 'colega@x.com',
    member_id: null,
    invited_at: 'now',
    accepted_at: null,
    revoked_at: null,
    owner_id: 'o1',
    subscription_id: 'sub-1',
  };

  it('rejects an unknown token', async () => {
    mockDb({ seatByToken: null });
    const { acceptInvite } = await import('@/lib/billing/seat-members');
    expect(await acceptInvite({ token: 'nope', password: 'senha12345' })).toEqual({
      ok: false,
      reason: 'invalid_token',
    });
  });

  it('rejects a token that was already used', async () => {
    mockDb({ seatByToken: { ...pendingSeat, accepted_at: 'ontem' } });
    const { acceptInvite } = await import('@/lib/billing/seat-members');
    expect(await acceptInvite({ token: 't', password: 'senha12345' })).toEqual({
      ok: false,
      reason: 'already_accepted',
    });
  });

  it('requires a usable password when the account does not exist yet', async () => {
    mockDb({ seatByToken: pendingSeat, existingUserId: null });
    const { acceptInvite } = await import('@/lib/billing/seat-members');
    expect(await acceptInvite({ token: 't', password: '123' })).toEqual({
      ok: false,
      reason: 'weak_password',
    });
  });

  it('creates the account and links the seat', async () => {
    const { createUser } = mockDb({ seatByToken: pendingSeat, existingUserId: null });
    const { acceptInvite } = await import('@/lib/billing/seat-members');
    const res = await acceptInvite({ token: 't', password: 'senha12345', fullName: 'Maria' });
    expect(res).toEqual({ ok: true, email: 'colega@x.com', created: true });
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'colega@x.com', email_confirm: true }),
    );
  });

  it('never touches the password of someone who already has an account', async () => {
    const { createUser } = mockDb({ seatByToken: pendingSeat, existingUserId: 'existing-user' });
    const { acceptInvite } = await import('@/lib/billing/seat-members');
    const res = await acceptInvite({ token: 't', password: 'qualquercoisa' });
    expect(res).toEqual({ ok: true, email: 'colega@x.com', created: false });
    expect(createUser).not.toHaveBeenCalled();
  });
});
