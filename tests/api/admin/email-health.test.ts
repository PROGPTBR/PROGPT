import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.EMAIL_FROM;
});

function setSmtpEnv() {
  process.env.SMTP_HOST = 'smtp.titan.email';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'comercial@2bsupply.com.br';
  process.env.SMTP_PASSWORD = 'secret';
}

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

  it('flags missing SMTP credentials', async () => {
    mockAdmin(true);
    const { GET } = await import('@/app/api/admin/email-health/route');
    const res = await GET();
    const body = await res.json();
    expect(body.hasKey).toBe(false);
    expect(body.warning).toMatch(/ausente/);
  });

  it('flags a From that does not match SMTP_USER even when credentials are set', async () => {
    setSmtpEnv();
    process.env.EMAIL_FROM = 'PROGPT <outra-caixa@2bsupply.com.br>';
    mockAdmin(true);
    const { GET } = await import('@/app/api/admin/email-health/route');
    const res = await GET();
    const body = await res.json();
    expect(body.hasKey).toBe(true);
    expect(body.isSandboxFrom).toBe(true);
    expect(body.warning).toMatch(/não bate/);
  });

  it('reports clean state with real domain configured', async () => {
    setSmtpEnv();
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
