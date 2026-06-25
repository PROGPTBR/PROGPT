// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Sub-projeto 36.2 — SignupForm card-first: coleta nome/CPF/e-mail (sem senha)
// e POSTa /api/auth/start-trial, redirecionando pro checkout do Asaas. A conta
// só é criada depois do cartão.

const VALID_CPF = '11144477735'; // CPF válido (módulo 11) pra liberar o submit

beforeEach(() => {
  vi.resetModules();
  // window.location.href é setado no sucesso → mock navegável em jsdom.
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(opts: {
  fetchResult?: { status: number; body?: Record<string, unknown> };
}) {
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: (opts.fetchResult?.status ?? 200) < 400,
    status: opts.fetchResult?.status ?? 200,
    json: async () =>
      opts.fetchResult?.body ?? { checkoutUrl: 'https://asaas/checkout' },
  });
  vi.stubGlobal('fetch', fetchSpy);
  vi.doMock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
  }));
  vi.doMock('@/components/auth/TurnstileWidget', () => ({
    TurnstileWidget: ({ onVerify }: { onVerify: (t: string) => void }) => {
      setTimeout(() => onVerify('test-token'), 0);
      return null;
    },
  }));
  return { fetchSpy };
}

async function fillAndSubmit(opts?: { email?: string; cpf?: string; terms?: boolean }) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nome completo'), 'Fulano de Tal');
  await user.type(screen.getByLabelText('Email'), opts?.email ?? 'novo@user.com');
  await user.type(screen.getByLabelText('CPF'), opts?.cpf ?? VALID_CPF);
  if (opts?.terms !== false) {
    await user.click(screen.getByRole('checkbox', { name: /li e aceito/i }));
  }
  await new Promise((r) => setTimeout(r, 5)); // turnstile token
  await user.click(screen.getByRole('button', { name: /cadastrar cart/i }));
}

describe('SignupForm (card-first)', () => {
  it('POSTs /api/auth/start-trial com nome/email/cpf/captcha/terms', async () => {
    const { fetchSpy } = setup({});
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    await fillAndSubmit();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/start-trial',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((fetchSpy.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      email: 'novo@user.com',
      name: 'Fulano de Tal',
      captchaToken: 'test-token',
      acceptedTerms: true,
    });
    expect(body.cpf.replace(/\D/g, '')).toBe(VALID_CPF);
  });

  it('mostra confirmacao com botao pro checkout no sucesso', async () => {
    setup({ fetchResult: { status: 200, body: { checkoutUrl: 'https://asaas/checkout' } } });
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    await fillAndSubmit();
    const link = await screen.findByRole('link', { name: /cadastrar cart/i });
    expect(link.getAttribute('href')).toBe('https://asaas/checkout');
  });

  it('mostra "já existe" no 409 user_already_exists', async () => {
    setup({ fetchResult: { status: 409, body: { error: 'user_already_exists' } } });
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    await fillAndSubmit();
    expect(await screen.findByText(/j[áa] existe uma conta/i)).toBeTruthy();
  });

  it('bloqueia submit sem aceitar os termos', async () => {
    const { fetchSpy } = setup({});
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    await fillAndSubmit({ terms: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('bloqueia submit com CPF inválido', async () => {
    const { fetchSpy } = setup({});
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    await fillAndSubmit({ cpf: '12345678900' }); // CPF inválido
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renderiza link para /login', async () => {
    setup({});
    const { SignupForm } = await import('@/components/auth/SignupForm');
    render(<SignupForm />);
    const link = screen.getByRole('link', { name: /j[áa] tenho conta/i });
    expect(link.getAttribute('href')).toBe('/login');
  });
});
