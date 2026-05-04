import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID = {
  sessionId: '11111111-1111-1111-1111-111111111111',
  traceId: 'tr-abc',
  rating: 'up' as const,
};

describe('POST /api/feedback', () => {
  it('returns 401 when no authenticated user', async () => {
    vi.doMock('@/lib/auth', () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));
    vi.doMock('@/lib/feedback', () => ({ recordFeedback: vi.fn() }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body (rating outside enum)', async () => {
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
    }));
    vi.doMock('@/lib/feedback', () => ({ recordFeedback: vi.fn() }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq({ ...VALID, rating: 'meh' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when comment > 1000 chars', async () => {
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
    }));
    vi.doMock('@/lib/feedback', () => ({ recordFeedback: vi.fn() }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq({ ...VALID, comment: 'x'.repeat(1001) }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when recordFeedback reports session not owned', async () => {
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
    }));
    vi.doMock('@/lib/feedback', () => ({
      recordFeedback: vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(404);
  });

  it('returns 204 on success and forwards the input to recordFeedback', async () => {
    const recordFeedback = vi.fn().mockResolvedValue({ ok: true });
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
    }));
    vi.doMock('@/lib/feedback', () => ({ recordFeedback }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq({ ...VALID, rating: 'down', comment: 'meh' }));
    expect(res.status).toBe(204);
    expect(recordFeedback).toHaveBeenCalledWith({
      userId: 'u1',
      sessionId: VALID.sessionId,
      traceId: VALID.traceId,
      rating: 'down',
      comment: 'meh',
    });
  });

  it('returns 500 when recordFeedback reports DB failure', async () => {
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
    }));
    vi.doMock('@/lib/feedback', () => ({
      recordFeedback: vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(500);
  });
});
