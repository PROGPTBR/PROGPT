'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck, CreditCard, MailCheck } from 'lucide-react';
import { TurnstileWidget } from './TurnstileWidget';

const MIN_PASSWORD = 6;

// Classes compartilhadas com o LoginForm pra manter o MESMO padrão visual.
const INPUT_CLASS =
  'w-full rounded-lg bg-muted/40 border border-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';
const LABEL_CLASS =
  'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5';
const SUBMIT_CLASS =
  'w-full inline-flex items-center justify-center bg-brand-gradient text-black h-11 rounded-full text-sm font-semibold brand-glow disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none hover:brightness-110 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const ERROR_CLASS =
  'rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive';

type SignupState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'check-email' }
  | { kind: 'error'; message: string };

function friendlyError(code: string): string {
  switch (code) {
    case 'user_already_exists':
      return 'Já existe uma conta com este email. Use Entrar.';
    case 'password_weak':
      return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
    case 'captcha_invalid':
      return 'Verificação anti-bot falhou. Recarregue e tente de novo.';
    case 'rate_limited':
      return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
    case 'invalid_body':
      return 'Email ou senha inválidos.';
    default:
      return 'Algo deu errado. Tente novamente.';
  }
}

export function SignupForm() {
  const searchParams = useSearchParams();
  // Pós-cadastro vai direto pra tela do cartão (trial). O próprio /assinar
  // redireciona pro /chat se a conta já tiver acesso.
  const next = searchParams.get('next') ?? '/assinar';
  const plan = searchParams.get('plan');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [state, setState] = useState<SignupState>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setState({ kind: 'error', message: friendlyError('password_weak') });
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
      setState({ kind: 'error', message: friendlyError(body?.error ?? 'unknown') });
      return;
    }
    const body = await res.json();
    if (body.checkEmail) {
      setState({ kind: 'check-email' });
      return;
    }
    // Sessão criada na hora (confirmação de email desligada) → vai pro cartão.
    router.push(next);
    router.refresh();
  }

  if (state.kind === 'check-email') {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
          <MailCheck className="h-7 w-7 text-brand" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Confira seu email <span className="text-brand">.</span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enviamos um link de confirmação para{' '}
            <span className="font-medium text-brand">{email}</span>. Clique no
            link para ativar a conta — em seguida você cadastra o cartão e
            libera seus <strong className="text-foreground">3 dias grátis</strong>.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-brand hover:text-brand/80 transition-colors"
        >
          Voltar para Entrar
        </Link>
      </div>
    );
  }

  const submitting = state.kind === 'submitting';
  const errorMessage = state.kind === 'error' ? state.message : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Criar conta <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Comece seus 3 dias grátis — leva menos de 1 minuto.
        </p>
      </div>

      {/* Selo de confiança — comunica o trial sem cobrança imediata. */}
      <div className="flex items-center gap-2.5 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5">
        <ShieldCheck className="h-4 w-4 text-brand flex-shrink-0" aria-hidden="true" />
        <p className="text-xs text-foreground/80">
          3 dias grátis. O cartão é só pra ativar — <strong>nada é cobrado hoje</strong>.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-email" className={LABEL_CLASS}>
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="signup-password" className={LABEL_CLASS}>
            Senha
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${INPUT_CLASS} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
              title={showPw ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPw ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
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
          <div role="alert" className={ERROR_CLASS}>
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !captchaToken || !acceptedTerms}
          className={SUBMIT_CLASS}
        >
          {submitting ? (
            'Cadastrando…'
          ) : (
            <span className="inline-flex items-center gap-2">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Criar conta e cadastrar cartão
            </span>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-border text-center">
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
        >
          Já tenho conta
        </Link>
      </div>
    </div>
  );
}
