'use client';


import Link from 'next/link';
import { useState } from 'react';
import { TurnstileWidget } from './TurnstileWidget';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaToken) {
      setErrorMessage('Aguarde a verificação anti-bot terminar de carregar.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    const res = await fetch('/api/auth/reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, captchaToken }),
    });
    setLoading(false);
    if (res.status === 403) {
      setErrorMessage('Verificação anti-bot falhou. Tente novamente.');
      return;
    }
    if (res.status === 429) {
      setErrorMessage('Muitas tentativas. Aguarde um minuto.');
      return;
    }
    // 200 mesmo pra email inexistente (anti-enumeration).
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Verifique seu email <span className="text-brand">.</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          Se este email existir em nossa base, enviamos um link para redefinir a
          senha.
        </p>
        <div className="text-sm pt-2">
          <Link
            href="/login"
            className="text-brand hover:text-brand/80 transition-colors"
          >
            Voltar para Entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Esqueci minha senha <span className="text-brand">.</span>
        </h1>
        <p className="mt-1.5 text-lg text-muted-foreground">
          Enviaremos um link para redefinir sua senha.
        </p>
      </div>
      <div>
        <label
          htmlFor="forgot-email"
          className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
        >
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-muted/40 border border-input px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
        />
      </div>
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
        disabled={loading || !captchaToken}
        className="w-full inline-flex items-center justify-center bg-brand text-black h-11 rounded-full text-sm font-medium hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {loading ? 'Enviando…' : 'Enviar link'}
      </button>
      <div className="text-sm text-center pt-2 border-t border-border">
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground transition-colors inline-block pt-4 text-xs"
        >
          Voltar para Entrar
        </Link>
      </div>
    </form>
  );
}
