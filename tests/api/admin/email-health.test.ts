import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

function mockAdmin(isAdmin: boolean) {
  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error {
      constructor() {
        super('not admin');
        this.name = 'NotAdmin';
      }
    }
    return {
      requireAdmin: vi.fn().mockImplementation(() => {
        if (!isAdmin) throw new NotAdmin();
      }),
      NotAdmin,
    };
  });
}

describe('GET /api/admin/email-health', () => {
  it('returns 404 for non-admin', async () => {
    mockAdmin(false);
    const { GET } = await import('@/app/api/admin/email-health/route');
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('flags missing RESEND_API_KEY', async () => {
    mockAdmin(true);
    const { GET } = await import('@/app/api/admin/email-health/route');
    const res = await GET();
    const body = await res.json();
    expect(body.hasKey).toBe(false);
    expect(body.warning).toMatch(/ausente/);
  });

  it('flags sandbox EMAIL_FROM even when key is set', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockAdmin(true);
    const { GET } = await import('@/app/api/admin/email-health/route');
    const res = await GET();
    const body = await res.json();
    expect(body.hasKey).toBe(true);
    expect(body.isSandboxFrom).toBe(true);
    expect(body.warning).toMatch(/sandbox/);
  });

  it('reports clean state with real domain configured', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'PROGPT <noreply@2bsupply.com.br>';
    mockAdmin(true);
    const { GET } = await import('@/app/api/admin/email-health/route');
    const res = await GET();
    const body = await res.json();
    expect(body.isSandboxFrom).toBe(false);
    expect(body.warning).toBeNull();
  });
});

describe('POST /api/admin/email-health', () => {
  function buildReq(body: unknown): Request {
    return new Request('http://x/api/admin/email-health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 400 for invalid email', async () => {
    mockAdmin(true);
    const { POST } = await import('@/app/api/admin/email-health/route');
    const res = await POST(buildReq({ to: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('sends via sendEmail and returns the raw result', async () => {
    mockAdmin(true);
    vi.doMock('@/lib/email/client', () => ({
      sendEmail: vi.fn().mockResolvedValue({ ok: true, id: 'msg_1' }),
    }));
    const { POST } = await import('@/app/api/admin/email-health/route');
    const res = await POST(buildReq({ to: 'admin@2bsupply.com.br' }));
    const body = await res.json();
    expect(body).toEqual({ ok: true, id: 'msg_1' });
  });
});
