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
        <p className="mt-1.5 text-sm text-gray-400">
          Use seu email e senha para acessar.
        </p>
      </div>
      <form onSubmit={onPasswordSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand focus:bg-white/10 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Senha
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand focus:bg-white/10 transition-colors"
          />
        </div>
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center bg-brand text-black h-11 rounded-full text-sm font-medium hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <div className="text-sm text-center space-y-2 pt-2 border-t border-white/5">
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
            className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
          >
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </div>
  );
}
