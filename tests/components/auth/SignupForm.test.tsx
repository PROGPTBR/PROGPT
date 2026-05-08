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

type SignUpResult = {
  data: { session: unknown } | { session: null };
  error: null | { message: string; code?: string };
};

function mockBrowser(opts: {
  signUpResult?: SignUpResult;
  pushSpy?: ReturnType<typeof vi.fn>;
}) {
  const signUp = vi.fn().mockResolvedValue(
    opts.signUpResult ?? { data: { session: null }, error: null },
  );
  const push = opts.pushSpy ?? vi.fn();
  vi.doMock('@/lib/db/supabase-browser', () => ({
    supabaseBrowser: () => ({ auth: { signUp } }),
  }));
  vi.doMock('next/navigation', () => ({
    useRouter: () => ({ push, refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
  }));
  return { signUp, push };
}

describe('SignupForm', () => {
  it('submit calls auth.signUp with the email + password', async () => {
    const { signUp } = mockBrowser({});
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'novo@user.com');
    await user.type(screen.getByLabelText(/senha/i), 'pw1234');
    await user.click(screen.getByRole('button', { name: /cadastrar/i }));
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'novo@user.com', password: 'pw1234' }),
    );
  });

  it('shows the "check email" state when Supabase returns no session (email confirmation ON)', async () => {
    mockBrowser({ signUpResult: { data: { session: null }, error: null } });
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'novo@user.com');
    await user.type(screen.getByLabelText(/senha/i), 'pw1234');
    await user.click(screen.getByRole('button', { name: /cadastrar/i }));
    expect(await screen.findByText(/confira seu email/i)).toBeTruthy();
    expect(screen.getByText(/novo@user.com/)).toBeTruthy();
  });

  it('routes to next when Supabase returns a session (email confirmation OFF)', async () => {
    const push = vi.fn();
    mockBrowser({
      signUpResult: { data: { session: { user: { id: 'u' } } }, error: null },
      pushSpy: push,
    });
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'novo@user.com');
    await user.type(screen.getByLabelText(/senha/i), 'pw1234');
    await user.click(screen.getByRole('button', { name: /cadastrar/i }));
    expect(push).toHaveBeenCalledWith('/chat');
  });

  it('shows the "already registered" message on duplicate email error', async () => {
    mockBrowser({
      signUpResult: {
        data: { session: null },
        error: { message: 'User already registered' },
      },
    });
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/senha/i), 'pw1234');
    await user.click(screen.getByRole('button', { name: /cadastrar/i }));
    expect(await screen.findByText(/j[áa] existe uma conta/i)).toBeTruthy();
  });

  it('blocks submission with a too-short password before hitting the network', async () => {
    const { signUp } = mockBrowser({});
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    // 5 chars — under min of 6. The native input has minLength=6 which would
    // also block it; we exercise the JS-side guard explicitly.
    const pwField = screen.getByLabelText(/senha/i) as HTMLInputElement;
    pwField.removeAttribute('minLength');
    await user.type(pwField, 'pw123');
    await user.click(screen.getByRole('button', { name: /cadastrar/i }));
    expect(signUp).not.toHaveBeenCalled();
    expect(await screen.findByText(/pelo menos 6 caracteres/i)).toBeTruthy();
  });

  it('renders a link back to /login that preserves the next= param', async () => {
    mockBrowser({});
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    const link = screen.getByRole('link', { name: /j[áa] tenho conta/i });
    expect(link.getAttribute('href')).toBe('/login?next=%2Fchat');
  });
});
