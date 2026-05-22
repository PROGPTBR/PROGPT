import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/suppliers/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockAuth(user: { id: string } | null) {
  if (user) {
    vi.doMock('@/lib/auth', async () => {
      const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
      return {
        ...actual,
        getCurrentUser: vi.fn().mockResolvedValue(user),
        requireUser: vi.fn().mockResolvedValue(user),
      };
    });
  } else {
    vi.doMock('@/lib/auth', async () => {
      const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
      return {
        ...actual,
        getCurrentUser: vi.fn().mockResolvedValue(null),
        requireUser: vi.fn().mockImplementation(() => {
          throw new actual.NotAuthenticated();
        }),
      };
    });
  }
}

function mockRateLimit(allowed: boolean) {
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi.fn().mockResolvedValue(
      allowed ? { allowed: true } : { allowed: false, retryAfterSecs: 5 },
    ),
  }));
}

describe('POST /api/suppliers/classify', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(null);
    mockRateLimit(true);
    vi.doMock('@/lib/suppliers/cnae-classifier', () => ({ classifyCnae: vi.fn() }));
    const { POST } = await import('@/app/api/suppliers/classify/route');
    const res = await POST(makeReq({ query: 'embalagens' }));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(false);
    vi.doMock('@/lib/suppliers/cnae-classifier', () => ({ classifyCnae: vi.fn() }));
    const { POST } = await import('@/app/api/suppliers/classify/route');
    const res = await POST(makeReq({ query: 'embalagens' }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.retry_after_secs).toBe(5);
  });

  it('returns 400 when query is too short', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    vi.doMock('@/lib/suppliers/cnae-classifier', () => ({ classifyCnae: vi.fn() }));
    const { POST } = await import('@/app/api/suppliers/classify/route');
    const res = await POST(makeReq({ query: 'ab' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid JSON body', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    vi.doMock('@/lib/suppliers/cnae-classifier', () => ({ classifyCnae: vi.fn() }));
    const { POST } = await import('@/app/api/suppliers/classify/route');
    const req = new Request('http://localhost/api/suppliers/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('forwards classifier result on happy path', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    const classifyCnae = vi.fn().mockResolvedValue({
      cnaeCode: '2222600',
      cnaeName: 'Fabricação de embalagens plásticas',
      scope: 'regional',
      states: ['BA', 'PE'],
      confidence: 0.85,
      rationale: 'match direto',
      alternatives: [],
    });
    vi.doMock('@/lib/suppliers/cnae-classifier', () => ({ classifyCnae }));
    const { POST } = await import('@/app/api/suppliers/classify/route');
    const res = await POST(makeReq({ query: 'embalagens flexíveis no NE' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cnaeCode).toBe('2222600');
    expect(classifyCnae).toHaveBeenCalledWith('embalagens flexíveis no NE');
  });
});
