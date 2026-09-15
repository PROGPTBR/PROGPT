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
  signInPwResult?: { data?: { user: { id: string } | null }; error: null | { message: string; code?: string } };
  superAdmin?: boolean;
  searchParams?: URLSearchParams;
}) {
  const signInWithPassword = vi.fn().mockResolvedValue(
    opts.signInPwResult ?? { data: { user: { id: 'u1' } }, error: null },
  );
  const maybeSingle = vi.fn().mockResolvedValue({ data: { super_admin: opts.superAdmin ?? false } });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  vi.doMock('@/lib/db/supabase-browser', () => ({
    supabaseBrowser: () => ({
      auth: { signInWithPassword },
      from: () => ({ select }),
    }),
  }));
  const push = vi.fn();
  vi.doMock('next/navigation', () => ({
    useRouter: () => ({ push, refresh: vi.fn() }),
    useSearchParams: () => opts.searchParams ?? new URLSearchParams(),
  }));
  return { signInWithPassword, push };
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

  it('redirects a super admin to /plataforma instead of /chat when there is no explicit next', async () => {
    const { push } = mockBrowser({ superAdmin: true });
    const { LoginForm } = await import('@/components/auth/LoginForm');
    render(<LoginForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'super@progpt.com.br');
    await user.type(screen.getByLabelText('Senha'), 'pw1234');
    await user.click(screen.getByRole('button', { name: /entrar/i }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/plataforma'));
  });

  it('sends a non-super-admin to the default /chat', async () => {
    const { push } = mockBrowser({ superAdmin: false });
    const { LoginForm } = await import('@/components/auth/LoginForm');
    render(<LoginForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'cliente@empresa.com');
    await user.type(screen.getByLabelText('Senha'), 'pw1234');
    await user.click(screen.getByRole('button', { name: /entrar/i }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/chat'));
  });

  it('respects an explicit ?next= even for a super admin (does not override to /plataforma)', async () => {
    const { push } = mockBrowser({
      superAdmin: true,
      searchParams: new URLSearchParams('next=/assistants/kraljic'),
    });
    const { LoginForm } = await import('@/components/auth/LoginForm');
    render(<LoginForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'super@progpt.com.br');
    await user.type(screen.getByLabelText('Senha'), 'pw1234');
    await user.click(screen.getByRole('button', { name: /entrar/i }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/assistants/kraljic'));
  });
});
