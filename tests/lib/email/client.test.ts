import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

describe('sendEmail', () => {
  it('returns ok:false when RESEND_API_KEY missing (fail-soft)', async () => {
    const { sendEmail } = await import('@/lib/email/client');
    const r = await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>x</p>' });
    expect(r.ok).toBe(false);
  });

  it('sends via Resend when key is set', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    const sendSpy = vi.fn().mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    vi.doMock('resend', () => ({
      Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendSpy } })),
    }));
    const { sendEmail } = await import('@/lib/email/client');
    const r = await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>x</p>' });
    expect(r.ok).toBe(true);
    expect(r.id).toBe('msg_1');
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'x@y.com', subject: 's', html: '<p>x</p>' }),
      undefined,
    );
  });

  it('forwards idempotencyKey to Resend', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    const sendSpy = vi.fn().mockResolvedValue({ data: { id: 'msg_2' }, error: null });
    vi.doMock('resend', () => ({
      Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendSpy } })),
    }));
    const { sendEmail } = await import('@/lib/email/client');
    await sendEmail({
      to: 'x@y.com',
      subject: 's',
      html: '<p>x</p>',
      idempotencyKey: 'welcome:user-1',
    });
    expect(sendSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: 'welcome:user-1' }),
    );
  });

  it('returns ok:false when Resend returns error (fail-soft)', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.doMock('resend', () => ({
      Resend: vi.fn().mockImplementation(() => ({
        emails: {
          send: vi.fn().mockResolvedValue({ data: null, error: { message: 'rate limited' } }),
        },
      })),
    }));
    const { sendEmail } = await import('@/lib/email/client');
    const r = await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>x</p>' });
    expect(r.ok).toBe(false);
  });

  it('swallows exceptions (fail-soft)', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.doMock('resend', () => ({
      Resend: vi.fn().mockImplementation(() => ({
        emails: { send: vi.fn().mockRejectedValue(new Error('network down')) },
      })),
    }));
    const { sendEmail } = await import('@/lib/email/client');
    const r = await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>x</p>' });
    expect(r.ok).toBe(false);
  });

  it('uses EMAIL_FROM env override', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'PROGPT <hello@2bsupply.com.br>';
    const sendSpy = vi.fn().mockResolvedValue({ data: { id: 'x' }, error: null });
    vi.doMock('resend', () => ({
      Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendSpy } })),
    }));
    const { sendEmail } = await import('@/lib/email/client');
    await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>x</p>' });
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'PROGPT <hello@2bsupply.com.br>' }),
      undefined,
    );
  });
});
