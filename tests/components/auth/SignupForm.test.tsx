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

// Sub-projeto 25 — SignupForm agora chama /api/auth/signup proxy em vez de
// auth.signUp direto. Stub do Turnstile widget pra que o teste consiga
// "verificar" sem carregar a lib do Cloudflare.

function setup(opts: {
  fetchResult?: { status: number; body?: Record<string, unknown> };
  pushSpy?: ReturnType<typeof vi.fn>;
}) {
  const push = opts.pushSpy ?? vi.fn();
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: (opts.fetchResult?.status ?? 200) < 400,
    status: opts.fetchResult?.status ?? 200,
    json: async () =>
      opts.fetchResult?.body ?? { ok: true, checkEmail: true },
  });
  vi.stubGlobal('fetch', fetchSpy);
  vi.doMock('next/navigation', () => ({
    useRouter: () => ({ push, refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
  }));
  // Stub do Turnstile widget — auto-verifica com token fake.
  vi.doMock('@/components/auth/TurnstileWidget', () => ({
    TurnstileWidget: ({ onVerify }: { onVerify: (t: string) => void }) => {
      // Emite o token assíncronamente pra simular o callback real.
      setTimeout(() => onVerify('test-token'), 0);
      return null;
    },
  }));
  return { push, fetchSpy };
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/senha/i), password);
  // Espera o Turnstile emitir token (setTimeout 0)
  await new Promise((r) => setTimeout(r, 5));
  await user.click(screen.getByRole('button', { name: /cadastrar/i }));
}

describe('SignupForm', () => {
  it('POSTs /api/auth/signup with email + password + captchaToken', async () => {
    const { fetchSpy } = setup({});
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    await fillAndSubmit('novo@user.com', 'pw1234');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/signup',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('novo@user.com'),
      }),
    );
    const body = JSON.parse((fetchSpy.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      email: 'novo@user.com',
      password: 'pw1234',
      captchaToken: 'test-token',
    });
  });

  it('shows the "check email" state when API returns checkEmail:true', async () => {
    setup({ fetchResult: { status: 200, body: { ok: true, checkEmail: true } } });
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    await fillAndSubmit('novo@user.com', 'pw1234');
    expect(await screen.findByText(/confira seu email/i)).toBeTruthy();
    expect(screen.getByText(/novo@user.com/)).toBeTruthy();
  });

  it('routes to next when API returns checkEmail:false (email confirmation OFF)', async () => {
    const push = vi.fn();
    setup({
      fetchResult: { status: 200, body: { ok: true, checkEmail: false } },
      pushSpy: push,
    });
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    await fillAndSubmit('novo@user.com', 'pw1234');
    await new Promise((r) => setTimeout(r, 10));
    expect(push).toHaveBeenCalledWith('/chat');
  });

  it('shows "já existe" on 409 user_already_exists', async () => {
    setup({ fetchResult: { status: 409, body: { error: 'user_already_exists' } } });
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    await fillAndSubmit('a@b.com', 'pw1234');
    expect(await screen.findByText(/j[áa] existe uma conta/i)).toBeTruthy();
  });

  it('blocks submission with too-short password before hitting the network', async () => {
    const { fetchSpy } = setup({});
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    const pwField = screen.getByLabelText(/senha/i) as HTMLInputElement;
    pwField.removeAttribute('minLength');
    await user.type(pwField, 'pw123');
    await new Promise((r) => setTimeout(r, 5));
    await user.click(screen.getByRole('button', { name: /cadastrar/i }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await screen.findByText(/pelo menos 6 caracteres/i)).toBeTruthy();
  });

  it('renders a link back to /login that preserves the next= param', async () => {
    setup({});
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    const link = screen.getByRole('link', { name: /j[áa] tenho conta/i });
    expect(link.getAttribute('href')).toBe('/login?next=%2Fchat');
  });
});
