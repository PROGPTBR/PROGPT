'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

function friendlyError(error: { message: string; code?: string } | null): string | null {
  if (!error) return null;
  if (error.message?.toLowerCase().includes('invalid login credentials')) {
    return 'Email ou senha incorretos.';
  }
  return 'Algo deu errado. Tente novamente.';
}

const INPUT_CLASS =
  'w-full rounded-lg bg-white border border-border px-4 py-2.5 text-lg text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors';
const LABEL_CLASS =
  'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2';
const SUBMIT_CLASS =
  'w-full inline-flex items-center justify-center bg-brand text-black h-11 rounded-full text-sm font-medium bg-brand-gradient disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const ERROR_CLASS =
  'rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/chat';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const sb = supabaseBrowser();
    const { error: err } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(friendlyError(err));
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Entrar <span className="text-brand">.</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Use seu email e senha para acessar.
        </p>
      </div>
      <form onSubmit={onPasswordSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={LABEL_CLASS}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="password" className={LABEL_CLASS}>
            Senha
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        {error ? (
          <div role="alert" className={ERROR_CLASS}>
            {error}
          </div>
        ) : null}
        <button type="submit" disabled={loading} className={SUBMIT_CLASS}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <div className="text-sm text-center space-y-2 pt-2 border-t border-border">
        <div className="pt-4">
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="text-brand hover:text-brand/80 transition-colors"
          >
            Criar conta
          </Link>
        </div>
        <div>
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground transition-colors text-xs"
          >
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </div>
  );
}
