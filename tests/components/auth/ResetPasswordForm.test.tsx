// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => cleanup());

function mockBrowser(opts: {
  user?: { id: string } | null;
  updateResult?: { error: null | { message: string } };
}) {
  const updateUser = vi.fn().mockResolvedValue(opts.updateResult ?? { error: null });
  const session = opts.user ? { user: opts.user, access_token: 'access', refresh_token: 'refresh' } : null;
  const setSession = vi.fn().mockResolvedValue({ data: { session }, error: null });
  vi.doMock('@/lib/db/supabase-browser', () => ({
    supabaseBrowser: () => ({
      auth: {
        updateUser,
        getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        setSession,
        exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      },
    }),
  }));
  const push = vi.fn();
  vi.doMock('next/navigation', () => ({
    useRouter: () => ({ push, refresh: vi.fn() }),
  }));
  return { updateUser, setSession, push };
}

describe('ResetPasswordForm', () => {
  it('establishes the recovery session from implicit tokens in the URL hash', async () => {
    window.history.replaceState(
      null,
      '',
      '/reset-password#access_token=token-a&refresh_token=token-r&type=recovery',
    );
    const { setSession } = mockBrowser({ user: { id: 'u1' } });
    const { ResetPasswordForm } = await import('@/components/auth/ResetPasswordForm');
    render(<ResetPasswordForm />);

    expect(await screen.findByLabelText(/^nova senha/i)).toBeTruthy();
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'token-a',
      refresh_token: 'token-r',
    });
    expect(window.location.hash).toBe('');
  });

  it('submit with matching passwords calls updateUser and redirects', async () => {
    const { updateUser, push } = mockBrowser({ user: { id: 'u1' } });
    const { ResetPasswordForm } = await import('@/components/auth/ResetPasswordForm');
    render(<ResetPasswordForm />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/^nova senha/i), 'novaSenha1');
    await user.type(screen.getByLabelText(/confirmar/i), 'novaSenha1');
    await user.click(screen.getByRole('button', { name: /redefinir/i }));
    expect(updateUser).toHaveBeenCalledWith({ password: 'novaSenha1' });
    // give the promise microtask a tick to flush
    await new Promise((r) => setTimeout(r, 0));
    expect(push).toHaveBeenCalledWith('/chat');
  });

  it('blocks submit when passwords do not match', async () => {
    const { updateUser } = mockBrowser({ user: { id: 'u1' } });
    const { ResetPasswordForm } = await import('@/components/auth/ResetPasswordForm');
    render(<ResetPasswordForm />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/^nova senha/i), 'aaaa');
    await user.type(screen.getByLabelText(/confirmar/i), 'bbbb');
    await user.click(screen.getByRole('button', { name: /redefinir/i }));
    expect(updateUser).not.toHaveBeenCalled();
    expect(await screen.findByText(/não coincidem/i)).toBeTruthy();
  });

  it('translates the Supabase weak-password error', async () => {
    mockBrowser({
      user: { id: 'u1' },
      updateResult: {
        error: {
          message: 'Password is known to be weak and easy to guess, please choose a different one.',
        },
      },
    });
    const { ResetPasswordForm } = await import('@/components/auth/ResetPasswordForm');
    render(<ResetPasswordForm />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/^nova senha/i), '123456');
    await user.type(screen.getByLabelText(/confirmar/i), '123456');
    await user.click(screen.getByRole('button', { name: /redefinir/i }));

    expect(await screen.findByText(/a senha é conhecida por ser fraca/i)).toBeTruthy();
  });

  it('translates the Supabase reused-password error', async () => {
    mockBrowser({
      user: { id: 'u1' },
      updateResult: {
        error: { message: 'New password should be different from the old password.' },
      },
    });
    const { ResetPasswordForm } = await import('@/components/auth/ResetPasswordForm');
    render(<ResetPasswordForm />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/^nova senha/i), 'SenhaAnterior123!');
    await user.type(screen.getByLabelText(/confirmar/i), 'SenhaAnterior123!');
    await user.click(screen.getByRole('button', { name: /redefinir/i }));

    expect(await screen.findByText('A nova senha deve ser diferente da senha anterior.')).toBeTruthy();
  });

  it('shows and hides both password fields independently', async () => {
    mockBrowser({ user: { id: 'u1' } });
    const { ResetPasswordForm } = await import('@/components/auth/ResetPasswordForm');
    render(<ResetPasswordForm />);
    const user = userEvent.setup();
    const password = await screen.findByLabelText(/^nova senha/i);
    const confirmation = screen.getByLabelText(/confirmar/i);

    expect(password.getAttribute('type')).toBe('password');
    expect(confirmation.getAttribute('type')).toBe('password');
    await user.click(screen.getByRole('button', { name: 'Mostrar nova senha' }));
    expect(password.getAttribute('type')).toBe('text');
    expect(confirmation.getAttribute('type')).toBe('password');
    await user.click(screen.getByRole('button', { name: 'Mostrar confirmação da senha' }));
    expect(confirmation.getAttribute('type')).toBe('text');
  });

  it('shows "request new link" CTA when there is no session', async () => {
    mockBrowser({ user: null });
    const { ResetPasswordForm } = await import('@/components/auth/ResetPasswordForm');
    render(<ResetPasswordForm />);
    expect(await screen.findByText(/solicite um novo link|solicitar novo link/i)).toBeTruthy();
  });
});
