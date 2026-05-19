'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

const MIN_PASSWORD = 6;

function friendlyError(error: { message?: string; code?: string } | null): string | null {
  if (!error) return null;
  const msg = (error.message ?? '').toLowerCase();
  if (msg.includes('already registered') || msg.includes('user already')) {
    return 'Já existe uma conta com este email. Use Entrar.';
  }
  if (msg.includes('password') && (msg.includes('short') || msg.includes('weak'))) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  }
  if (msg.includes('rate limit') || error.code === 'over_email_send_rate_limit') {
    return 'Muitas tentativas. Espere um minuto e tente novamente.';
  }
  return 'Algo deu errado. Tente novamente.';
}

type SignupState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'check-email' }
  | { kind: 'error'; message: string };

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/chat';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    setState({ kind: 'submitting' });
    const sb = supabaseBrowser();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setState({ kind: 'error', message: friendlyError(error) ?? 'Erro desconhecido' });
      return;
    }
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }
    setState({ kind: 'check-email' });
  }

  if (state.kind === 'check-email') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Confira seu email <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          Enviamos um link de confirmação para{' '}
          <span className="font-medium text-white">{email}</span>. Clique no link
          para ativar a conta e poder entrar.
        </p>
        <div className="text-sm pt-2">
          <Link href="/login" className="text-brand hover:text-brand/80 transition-colors">
            Voltar para Entrar
          </Link>
        </div>
      </div>
    );
  }

  const submitting = state.kind === 'submitting';
  const errorMessage = state.kind === 'error' ? state.message : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Criar conta <span className="text-brand">.</span>
        </h1>
        <p className="mt-1.5 text-sm text-gray-400">
          Use seu email para começar.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="signup-email"
            className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2"
          >
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand focus:bg-white/10 transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="signup-password"
            className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2"
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
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand focus:bg-white/10 transition-colors"
          />
          <p className="mt-2 text-xs text-gray-500">
            Mínimo {MIN_PASSWORD} caracteres.
          </p>
        </div>
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {errorMessage}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center bg-brand text-black h-11 rounded-full text-sm font-medium hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
        >
          {submitting ? 'Cadastrando…' : 'Cadastrar'}
        </button>
      </form>
      <div className="text-sm text-center pt-2 border-t border-white/5">
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="text-brand hover:text-brand/80 transition-colors inline-block pt-4"
        >
          Já tenho conta
        </Link>
      </div>
    </div>
  );
}
