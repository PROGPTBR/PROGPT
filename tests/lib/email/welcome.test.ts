import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupMocks(opts: {
  lockData?: { id: string }[] | null;
  lockError?: { message: string } | null;
  sendResult?: { ok: boolean; id?: string };
  magicLink?: string | null;
}) {
  const select = vi.fn().mockResolvedValue({
    data: opts.lockData ?? null,
    error: opts.lockError ?? null,
  });
  const is = vi.fn().mockReturnValue({ select });
  const eq = vi.fn().mockReturnValue({ is });
  const update = vi.fn().mockReturnValue({ eq });

  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({ from: () => ({ update }) }),
  }));

  const sendEmail = vi
    .fn()
    .mockResolvedValue(opts.sendResult ?? { ok: true, id: 'msg_1' });
  vi.doMock('@/lib/email/client', () => ({ sendEmail }));
  const buildWelcomeEmail = vi
    .fn()
    .mockReturnValue({ subject: 's', html: '<p>x</p>' });
  vi.doMock('@/lib/email/templates', () => ({ buildWelcomeEmail }));
  const generateMagicLink = vi
    .fn()
    .mockResolvedValue(opts.magicLink ?? null);
  vi.doMock('@/lib/email/magic-link', () => ({ generateMagicLink }));

  return { update, eq, is, select, sendEmail, buildWelcomeEmail, generateMagicLink };
}

describe('ensureWelcomeEmailSent', () => {
  it('acquires the lock then sends when welcome_email_sent_at is null', async () => {
    const { update, sendEmail } = setupMocks({ lockData: [{ id: 'u1' }] });
    const { ensureWelcomeEmailSent } = await import('@/lib/email/welcome');
    await ensureWelcomeEmailSent('u1', 'x@y.com');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ welcome_email_sent_at: expect.any(String) }),
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'x@y.com', idempotencyKey: 'welcome:u1' }),
    );
  });

  it('forwards a successfully generated magic link into the template', async () => {
    const { buildWelcomeEmail, generateMagicLink } = setupMocks({
      lockData: [{ id: 'u1' }],
      magicLink: 'https://x.supabase.co/auth/v1/verify?type=magiclink&token=abc',
    });
    const { ensureWelcomeEmailSent } = await import('@/lib/email/welcome');
    await ensureWelcomeEmailSent('u1', 'x@y.com');
    expect(generateMagicLink).toHaveBeenCalledWith('x@y.com');
    expect(buildWelcomeEmail).toHaveBeenCalledWith({
      email: 'x@y.com',
      magicLink: 'https://x.supabase.co/auth/v1/verify?type=magiclink&token=abc',
    });
  });

  it('still sends the welcome email when magic link generation fails-soft (null)', async () => {
    const { buildWelcomeEmail, sendEmail } = setupMocks({
      lockData: [{ id: 'u1' }],
      magicLink: null,
    });
    const { ensureWelcomeEmailSent } = await import('@/lib/email/welcome');
    await ensureWelcomeEmailSent('u1', 'x@y.com');
    expect(buildWelcomeEmail).toHaveBeenCalledWith({ email: 'x@y.com', magicLink: null });
    expect(sendEmail).toHaveBeenCalled();
  });

  it('is a noop when the lock is already held (already sent)', async () => {
    const { sendEmail } = setupMocks({ lockData: [] });
    const { ensureWelcomeEmailSent } = await import('@/lib/email/welcome');
    await ensureWelcomeEmailSent('u1', 'x@y.com');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not throw when the lock update errors', async () => {
    const { sendEmail } = setupMocks({
      lockData: null,
      lockError: { message: 'db down' },
    });
    const { ensureWelcomeEmailSent } = await import('@/lib/email/welcome');
    await expect(
      ensureWelcomeEmailSent('u1', 'x@y.com'),
    ).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not throw when sendEmail fails-soft', async () => {
    setupMocks({ lockData: [{ id: 'u1' }], sendResult: { ok: false } });
    const { ensureWelcomeEmailSent } = await import('@/lib/email/welcome');
    await expect(
      ensureWelcomeEmailSent('u1', 'x@y.com'),
    ).resolves.toBeUndefined();
  });
});
