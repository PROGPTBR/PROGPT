'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const sb = supabaseBrowser();
    await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Verifique seu email <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Esqueci minha senha <span className="text-brand">.</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
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
          className="w-full rounded-lg bg-muted/40 border border-border px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
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
