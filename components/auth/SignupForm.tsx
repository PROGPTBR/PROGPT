'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { TurnstileWidget } from './TurnstileWidget';
import { isValidCpf, formatCpf } from '@/lib/validators/cpf';

// Sub-projeto 36.2 — onboarding CARD-FIRST.
// Coletamos nome/CPF/e-mail (SEM senha) e mandamos pro Asaas cadastrar o cartão.
// A conta só é criada DEPOIS do cartão; a senha o cliente define por e-mail.

const INPUT_CLASS =
  'w-full rounded-lg bg-muted/40 border border-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';
const LABEL_CLASS =
  'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5';
const SUBMIT_CLASS =
  'w-full inline-flex items-center justify-center gap-2 bg-brand-gradient text-black h-11 rounded-full text-sm font-semibold brand-glow disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none hover:brightness-110 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const ERROR_CLASS =
  'rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive';

function maskCPF(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
}

function maskPhone(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return numbers.replace(/^(\d{2})(\d+)/, '($1) $2');
  return numbers.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
}

function friendlyError(code: string): string {
  switch (code) {
    case 'user_already_exists':
      return 'Já existe uma conta com este email. Use Entrar.';
    case 'invalid_cpf':
      return 'CPF inválido — verifique os dígitos.';
    case 'captcha_invalid':
      return 'Verificação anti-bot falhou. Recarregue e tente de novo.';
    case 'rate_limited':
      return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
    case 'billing_provider_error':
    case 'invalid_customer_data':
      return 'Não foi possível iniciar o cadastro do cartão. Confira os dados e tente de novo.';
    default:
      return 'Algo deu errado. Tente novamente.';
  }
}

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

export function SignupForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpfInput, setCpfInput] = useState('');
  const [phone, setPhone] = useState('');
  const [professionalRequirement, setProfessionalRequirement] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });

  const cpfClean = formatCpf(cpfInput);
  const cpfOk = isValidCpf(cpfClean);
  const nameOk = name.trim().length >= 2;
  const submitting = state.kind === 'submitting';
  const canSubmit = nameOk && cpfOk && !!email && acceptedTerms && !!captchaToken && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cpfOk) {
      setState({ kind: 'error', message: friendlyError('invalid_cpf') });
      return;
    }
    if (!acceptedTerms) {
      setState({
        kind: 'error',
        message: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.',
      });
      return;
    }
    if (!captchaToken) {
      setState({ kind: 'error', message: 'Aguarde a verificação anti-bot terminar de carregar.' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      const res = await fetch('/api/auth/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name.trim(),
          cpf: cpfClean,
          phone: phone.replace(/\D/g, ''),
          professionalRequirement,
          captchaToken,
          acceptedTerms: true,
          plan: plan ?? undefined,
        }),
      });
      const body = await res.json().catch(() => ({ error: 'unknown' }));
      if (!res.ok) {
        setState({ kind: 'error', message: friendlyError(body?.error ?? 'unknown') });
        return;
      }
      // Redireciona pro checkout do Asaas (cartão). A conta nasce depois.
      window.location.href = body.checkoutUrl;
    } catch (err) {
      console.error(err);
      setState({ kind: 'error', message: 'Erro de rede. Tente novamente.' });
    }
  }

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

      <div className="flex items-center gap-2.5 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5">
        <ShieldCheck className="h-4 w-4 text-brand flex-shrink-0" aria-hidden="true" />
        <p className="text-xs text-foreground/80">
          Cadastre o cartão pra ativar — <strong>nada é cobrado hoje</strong>. A senha
          você define depois, por e-mail.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-name" className={LABEL_CLASS}>
            Nome completo
          </label>
          <input
            id="signup-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="signup-email" className={LABEL_CLASS}>
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="signup-cpf" className={LABEL_CLASS}>
            CPF
          </label>
          <input
            id="signup-cpf"
            type="text"
            required
            inputMode="numeric"
            autoComplete="off"
            value={cpfInput}
            onChange={(e) => setCpfInput(maskCPF(e.target.value))}
            className={INPUT_CLASS}
          />
          {cpfInput.length > 0 && !cpfOk && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              CPF inválido — verifique os dígitos.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="signup-phone" className={LABEL_CLASS}>
            Telefone
          </label>
          <input
            id="signup-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="signup-req" className={LABEL_CLASS}>
            Exigência profissional
          </label>
          <input
            id="signup-req"
            type="text"
            value={professionalRequirement}
            onChange={(e) => setProfessionalRequirement(e.target.value)}
            placeholder="Ex.: Comprador, Gerente de Suprimentos…"
            className={INPUT_CLASS}
          />
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
            <Link href="/termos" target="_blank" className="text-brand hover:text-brand/80 underline underline-offset-2">
              Termos de Uso
            </Link>{' '}
            e a{' '}
            <Link href="/privacidade" target="_blank" className="text-brand hover:text-brand/80 underline underline-offset-2">
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

        <button type="submit" disabled={!canSubmit} className={SUBMIT_CLASS}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Redirecionando…
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Cadastrar cartão e começar
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </>
          )}
        </button>
        <p className="text-[11px] text-muted-foreground text-center">
          Você vai pro ambiente seguro do Asaas pra inserir o cartão. Sem cobrança
          nos 3 dias.
        </p>
      </form>

      <div className="pt-4 border-t border-border text-center">
        <Link href="/login" className="text-sm font-medium text-brand hover:text-brand/80 transition-colors">
          Já tenho conta
        </Link>
      </div>
    </div>
  );
}
