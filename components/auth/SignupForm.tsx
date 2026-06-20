'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { TurnstileWidget } from './TurnstileWidget';

const MIN_PASSWORD = 6;

{/* function friendlyError(code: string): string {
  switch (code) {
    case 'user_already_exists':
      return 'Já existe uma conta com este email. Use Entrar.';
    case 'password_weak':
      return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
    case 'captcha_invalid':
      return 'Verificação anti-bot falhou. Tente novamente.';
    case 'rate_limited':
      return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
    case 'invalid_body':
      return 'Email ou senha inválidos.';
    default:
      return 'Algo deu errado. Tente novamente.';
  }
}*/}

type SignupState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'check-email' }
  | { kind: 'error'; message: string };

export function SignupForm() {
  const searchParams = useSearchParams();

const plan = searchParams.get('plan');
const next = searchParams.get('next') ?? '/chat';

const router = useRouter();

  console.log('Plano escolhido:', plan);

 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [state, setState] = useState<SignupState>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setState({
        kind: 'error',
        message: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`,
      });
      return;
    }
    if (!acceptedTerms) {
      setState({
        kind: 'error',
        message:
          'Você precisa aceitar os Termos de Uso e a Política de Privacidade.',
      });
      return;
    }
    if (!captchaToken) {
      setState({
        kind: 'error',
        message: 'Aguarde a verificação anti-bot terminar de carregar.',
      });
      return;
    }
    setState({ kind: 'submitting' });
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
  email,
  password,
  captchaToken,
  next,
  acceptedTerms: true,
  plan: plan ?? undefined,
}),
    });
 if (!res.ok) {
  const body = await res.json().catch(() => ({ error: 'unknown' }));

  console.log('ERRO API SIGNUP:', body);

  setState({
    kind: 'error',
    message: JSON.stringify(body),
  });

  return;
}
    const body = await res.json();
    if (body.checkEmail) {
      setState({ kind: 'check-email' });
      return;
    }
    router.push(next);
    router.refresh();
  }

  if (state.kind === 'check-email') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Confira seu email <span className="text-brand">.</span>
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Enviamos um link de confirmação para{' '}
          <span className="font-medium text-brand">{email}</span>. Clique no link
          para ativar a conta e poder entrar.
        </p>
        <div className="text-base pt-2">
          <Link href="/login" className="text-brand hover:text-brand/80 transition-colors">
            Voltar para Entrar
          </Link>
        </div>
      </div>
    );
  }

  const submitting = state.kind === 'submitting';
  const errorMessage = state.kind === 'error' ? state.message : null;

  const planName =
  plan === 'pf-99'
    ? 'Plano Pessoa Física'
    : plan === 'pj'
    ? 'Plano Pessoa Jurídica'
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Criar conta <span className="text-brand">.</span>
        </h1>
        <p className="mt-1.5 text-lg text-muted-foreground">
          Use seu email para começar.
        </p>

        {planName && (
  <div className="mt-4 rounded-lg border border-brand/20 bg-brand/5 p-3">
    <p className="text-sm text-brand font-medium">
      Plano selecionado: <span className="text-brand">{planName}</span>
    </p>
  </div>
)}
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="signup-email"
            className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
          >
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-white border border-border px-4 py-2.5 text-lg text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="signup-password"
            className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
          >
            Senha
          </label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-white border border-border px-4 py-2.5 text-lg text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Mínimo {MIN_PASSWORD} caracteres.
          </p>
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-brand cursor-pointer"
          />
          <span>
            Li e aceito os{' '}
            <Link
              href="/termos"
              target="_blank"
              className="text-brand hover:text-brand/80 underline underline-offset-2"
            >
              Termos de Uso
            </Link>{' '}
            e a{' '}
            <Link
              href="/privacidade"
              target="_blank"
              className="text-brand hover:text-brand/80 underline underline-offset-2"
            >
              Política de Privacidade
            </Link>
            .
          </span>
        </label>
        <TurnstileWidget onVerify={setCaptchaToken} />
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
          >
            {errorMessage}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={submitting || !captchaToken || !acceptedTerms}
          className="w-full inline-flex items-center justify-center bg-brand-gradient text-black h-11 rounded-full text-sm font-medium button-gradient disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {submitting ? 'Cadastrando…' : 'Cadastrar'}
        </button>
      </form>
      <div className="text-sm text-center pt-2 border-t border-p-1 pt-4">
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="text-brand hover:text-brand/80 transition-colors text-2xl font-medium"
        >
          Já tenho conta
        </Link>
      </div>
    </div>
  );
}
