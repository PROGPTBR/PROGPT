'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { supabaseBrowser } from '@/lib/db/supabase-browser';


function friendlyError(error: { message: string; code?: string } | null): string | null {
  if (!error) return null;
  if (error.message?.toLowerCase().includes('invalid login credentials')) {
    return 'Email ou senha incorretos.';
  }
  return 'Algo deu errado. Tente novamente.';
}

const INPUT_CLASS =
  'w-full rounded-lg bg-muted/40 border border-input px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';
const LABEL_CLASS =
  'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5';
const SUBMIT_CLASS =
  'w-full inline-flex items-center justify-center bg-brand-gradient text-black h-11 rounded-full text-sm font-semibold brand-glow disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none hover:brightness-110 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const ERROR_CLASS =
  'rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/chat';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
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
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Entrar <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground">
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
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASS}  placeholder="Digite seu e-mail"
          />
        </div>
        <div>
          <label htmlFor="password" className={LABEL_CLASS}>
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              required
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
      <div className="pt-4 border-t border-border space-y-3 text-center">
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="inline-block text-sm font-medium text-brand hover:text-brand/80 transition-colors"
        >
          Criar conta
        </Link>
        <div>
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </div>
  );
}
