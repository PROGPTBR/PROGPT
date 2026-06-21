// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  cleanup();
});

function mockBrowser(opts: {
  signInPwResult?: { error: null | { message: string; code?: string } };
}) {
  const signInWithPassword = vi.fn().mockResolvedValue(
    opts.signInPwResult ?? { error: null },
  );
  vi.doMock('@/lib/db/supabase-browser', () => ({
    supabaseBrowser: () => ({
      auth: { signInWithPassword },
    }),
  }));
  vi.doMock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
  }));
  return { signInWithPassword };
}

describe('LoginForm', () => {
  it('email/password submit calls signInWithPassword with the values', async () => {
    const { signInWithPassword } = mockBrowser({});
    const { LoginForm } = await import('@/components/auth/LoginForm');
    render(<LoginForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    // Exact 'Senha' so it targets the field, not the "Mostrar senha" toggle.
    await user.type(screen.getByLabelText('Senha'), 'pw1234');
    await user.click(screen.getByRole('button', { name: /entrar/i }));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw1234' });
  });

  it('does not render a Google OAuth button (Google sign-in removed 2026-05-08)', async () => {
    mockBrowser({});
    const { LoginForm } = await import('@/components/auth/LoginForm');
    render(<LoginForm />);
    expect(screen.queryByRole('button', { name: /google/i })).toBeNull();
  });

  it('shows error when signInWithPassword returns invalid credentials', async () => {
    mockBrowser({ signInPwResult: { error: { message: 'Invalid login credentials' } } });
    const { LoginForm } = await import('@/components/auth/LoginForm');
    render(<LoginForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText('Senha'), 'pw');
    await user.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText(/email ou senha incorretos/i)).toBeTruthy();
  });

  it('renders a link to /forgot-password', async () => {
    mockBrowser({});
    const { LoginForm } = await import('@/components/auth/LoginForm');
    render(<LoginForm />);
    const link = screen.getByRole('link', { name: /esqueci minha senha/i });
    expect(link.getAttribute('href')).toBe('/forgot-password');
  });

  it('renders a link to /signup that preserves the next= param', async () => {
    mockBrowser({});
    const { LoginForm } = await import('@/components/auth/LoginForm');
    render(<LoginForm />);
    const link = screen.getByRole('link', { name: /criar conta/i });
    // useSearchParams mock returns empty params → next defaults to /chat
    expect(link.getAttribute('href')).toBe('/signup?next=%2Fchat');
  });
});
