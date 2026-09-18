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
      return { id: 'owner-1', email: 'dono@empresa.com' };
    }),
    getProfile: vi.fn().mockResolvedValue({ full_name: 'Dono da Empresa' }),
  }));
}

function mockSeats(over: Record<string, unknown> = {}) {
  const state = {
    seats: 3,
    extraSeats: 2,
    used: 0,
    available: 2,
    members: [],
    subscriptionId: 'sub-1',
  };
  const mod = {
    getSeatState: vi.fn().mockResolvedValue(state),
    inviteSeat: vi.fn().mockResolvedValue({
      ok: true,
      seat: { id: 's1', email: 'colega@x.com' },
      token: 'tok',
    }),
    sendSeatInvite: vi.fn().mockResolvedValue({ ok: true }),
    revokeSeat: vi.fn().mockResolvedValue(true),
    getPendingToken: vi.fn().mockResolvedValue({ token: 'tok', email: 'colega@x.com' }),
    ...over,
  };
  vi.doMock('@/lib/billing/seat-members', () => mod);
  return mod;
}

function req(body: unknown) {
  return new Request('http://x/api/account/seats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/account/seats', () => {
  it('401 without a session', async () => {
    mockAuth(false);
    mockSeats();
    const { GET } = await import('@/app/api/account/seats/route');
    expect((await GET()).status).toBe(401);
  });

  it('returns the seat state for the holder', async () => {
    mockAuth(true);
    mockSeats();
    const { GET } = await import('@/app/api/account/seats/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).available).toBe(2);
  });
});

describe('POST /api/account/seats', () => {
  it('invites and sends the email', async () => {
    mockAuth(true);
    const mod = mockSeats();
    const { POST } = await import('@/app/api/account/seats/route');
    const res = await POST(req({ email: 'colega@x.com' }));
    expect(res.status).toBe(200);
    expect(mod.sendSeatInvite).toHaveBeenCalled();
    expect((await res.json()).emailSent).toBe(true);
  });

  it('still reports success when the email fails, so the seat is not lost', async () => {
    mockAuth(true);
    mockSeats({ sendSeatInvite: vi.fn().mockResolvedValue({ ok: false }) });
    const { POST } = await import('@/app/api/account/seats/route');
    const res = await POST(req({ email: 'colega@x.com' }));
    expect(res.status).toBe(200);
    expect((await res.json()).emailSent).toBe(false);
  });

  it('explains in plain Portuguese when every paid seat is taken', async () => {
    mockAuth(true);
    mockSeats({
      inviteSeat: vi.fn().mockResolvedValue({ ok: false, reason: 'no_seats_available' }),
    });
    const { POST } = await import('@/app/api/account/seats/route');
    const res = await POST(req({ email: 'colega@x.com' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/acessos do seu plano já estão em uso/i);
  });
});

describe('DELETE /api/account/seats/[id]', () => {
  it('404 when the seat is not the holder’s', async () => {
    mockAuth(true);
    mockSeats({ revokeSeat: vi.fn().mockResolvedValue(false) });
    const { DELETE } = await import('@/app/api/account/seats/[id]/route');
    const res = await DELETE(new Request('http://x'), { params: { id: 'outro' } });
    expect(res.status).toBe(404);
  });

  it('revokes scoped to the logged-in holder', async () => {
    mockAuth(true);
    const mod = mockSeats();
    const { DELETE } = await import('@/app/api/account/seats/[id]/route');
    const res = await DELETE(new Request('http://x'), { params: { id: 's1' } });
    expect(res.status).toBe(200);
    expect(mod.revokeSeat).toHaveBeenCalledWith('owner-1', 's1');
  });
});
