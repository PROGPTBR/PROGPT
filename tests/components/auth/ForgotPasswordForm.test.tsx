// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(status = 200, body: Record<string, unknown> = { ok: true }) {
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchSpy);
  vi.doMock('@/components/auth/TurnstileWidget', () => ({
    TurnstileWidget: ({ onVerify }: { onVerify: (t: string) => void }) => {
      setTimeout(() => onVerify('test-token'), 0);
      return null;
    },
  }));
  return fetchSpy;
}

async function fill(email: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), email);
  await new Promise((r) => setTimeout(r, 5));
  await user.click(screen.getByRole('button', { name: /enviar link/i }));
}

describe('ForgotPasswordForm', () => {
  it('POSTs /api/auth/reset-request with email + captchaToken', async () => {
    const fetchSpy = setup();
    const { ForgotPasswordForm } = await import(
      '@/components/auth/ForgotPasswordForm'
    );
    render(<ForgotPasswordForm />);
    await fill('a@b.com');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/reset-request',
      expect.objectContaining({ method: 'POST' }),
    );
    const reqBody = JSON.parse(
      (fetchSpy.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(reqBody).toEqual({ email: 'a@b.com', captchaToken: 'test-token' });
  });

  it('shows success state after 200', async () => {
    setup();
    const { ForgotPasswordForm } = await import(
      '@/components/auth/ForgotPasswordForm'
    );
    render(<ForgotPasswordForm />);
    await fill('a@b.com');
    expect(await screen.findByText(/verifique seu email/i)).toBeTruthy();
  });

  it('shows captcha error on 403', async () => {
    setup(403, { error: 'captcha_invalid' });
    const { ForgotPasswordForm } = await import(
      '@/components/auth/ForgotPasswordForm'
    );
    render(<ForgotPasswordForm />);
    await fill('a@b.com');
    expect(await screen.findByText(/anti-bot falhou/i)).toBeTruthy();
  });
});
