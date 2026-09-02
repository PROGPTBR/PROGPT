import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.EMAIL_FROM;
});

function mockTransport(sendMail: ReturnType<typeof vi.fn>) {
  const createTransport = vi.fn().mockReturnValue({ sendMail });
  vi.doMock('nodemailer', () => ({ default: { createTransport } }));
  return { createTransport };
}

function setSmtpEnv() {
  process.env.SMTP_HOST = 'smtp.titan.email';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'comercial@2bsupply.com.br';
  process.env.SMTP_PASSWORD = 'secret';
}

describe('sendEmail', () => {
  it('returns ok:false when SMTP env is missing (fail-soft)', async () => {
    const { sendEmail } = await import('@/lib/email/client');
    const r = await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>x</p>' });
    expect(r.ok).toBe(false);
  });

  it('sends via SMTP when credentials are set', async () => {
    setSmtpEnv();
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg_1' });
    mockTransport(sendMail);
    const { sendEmail } = await import('@/lib/email/client');
    const r = await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>x</p>' });
    expect(r.ok).toBe(true);
    expect(r.id).toBe('msg_1');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'x@y.com', subject: 's', html: '<p>x</p>' }),
    );
  });

  it('accepts idempotencyKey without forwarding it (SMTP has no dedupe)', async () => {
    setSmtpEnv();
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg_2' });
    mockTransport(sendMail);
    const { sendEmail } = await import('@/lib/email/client');
    const r = await sendEmail({
      to: 'x@y.com',
      subject: 's',
      html: '<p>x</p>',
      idempotencyKey: 'welcome:user-1',
    });
    expect(r.ok).toBe(true);
    expect(sendMail.mock.calls[0]?.[0]).not.toHaveProperty('idempotencyKey');
  });

  it('returns ok:false when SMTP rejects the send (fail-soft)', async () => {
    setSmtpEnv();
    const sendMail = vi.fn().mockRejectedValue(new Error('rate limited'));
    mockTransport(sendMail);
    const { sendEmail } = await import('@/lib/email/client');
    const r = await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>x</p>' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('rate limited');
  });

  it('swallows exceptions (fail-soft)', async () => {
    setSmtpEnv();
    const sendMail = vi.fn().mockRejectedValue(new Error('network down'));
    mockTransport(sendMail);
    const { sendEmail } = await import('@/lib/email/client');
    const r = await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>x</p>' });
    expect(r.ok).toBe(false);
  });

  it('uses EMAIL_FROM env override', async () => {
    setSmtpEnv();
    process.env.EMAIL_FROM = 'PROGPT <hello@2bsupply.com.br>';
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'x' });
    mockTransport(sendMail);
    const { sendEmail } = await import('@/lib/email/client');
    await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>x</p>' });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'PROGPT <hello@2bsupply.com.br>' }),
    );
  });

  it('defaults From to the authenticated SMTP_USER when EMAIL_FROM is unset', async () => {
    setSmtpEnv();
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'x' });
    mockTransport(sendMail);
    const { sendEmail } = await import('@/lib/email/client');
    await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>x</p>' });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'PROGPT <comercial@2bsupply.com.br>' }),
    );
  });
});

describe('getEmailConfigStatus', () => {
  it('flags missing credentials', async () => {
    const { getEmailConfigStatus } = await import('@/lib/email/client');
    const status = getEmailConfigStatus();
    expect(status.hasKey).toBe(false);
  });

  it('reports a From matching SMTP_USER as not mismatched', async () => {
    setSmtpEnv();
    const { getEmailConfigStatus } = await import('@/lib/email/client');
    const status = getEmailConfigStatus();
    expect(status.hasKey).toBe(true);
    expect(status.isSandboxFrom).toBe(false);
    expect(status.from).toBe('PROGPT <comercial@2bsupply.com.br>');
  });

  it('flags a From that does not match SMTP_USER', async () => {
    setSmtpEnv();
    process.env.EMAIL_FROM = 'PROGPT <outra-caixa@2bsupply.com.br>';
    const { getEmailConfigStatus } = await import('@/lib/email/client');
    const status = getEmailConfigStatus();
    expect(status.isSandboxFrom).toBe(true);
  });
});
