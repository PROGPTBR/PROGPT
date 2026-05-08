'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { Button } from '@/components/ui/button';

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
    // If Supabase has email confirmation ON, `session` is null — user must
    // click the email link before they can log in. If it's OFF, `session`
    // is populated and we can route straight to /chat.
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }
    setState({ kind: 'check-email' });
  }

  if (state.kind === 'check-email') {
    return (
      <div className="w-full max-w-sm mx-auto p-6 space-y-4 text-center">
        <h1 className="text-xl font-semibold">Confira seu email</h1>
        <p className="text-sm text-muted-foreground">
          Enviamos um link de confirmação para <span className="font-medium text-foreground">{email}</span>.
          Clique no link para ativar a conta e poder entrar.
        </p>
        <div className="text-sm">
          <Link href="/login" className="text-primary hover:underline">
            Voltar para Entrar
          </Link>
        </div>
      </div>
    );
  }

  const submitting = state.kind === 'submitting';
  const errorMessage = state.kind === 'error' ? state.message : null;

  return (
    <div className="w-full max-w-sm mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use seu email para começar.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="signup-email" className="block text-sm mb-1">Email</label>
          <input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="block text-sm mb-1">Senha</label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Mínimo {MIN_PASSWORD} caracteres.
          </p>
        </div>
        {errorMessage ? (
          <div role="alert" className="text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Cadastrando…' : 'Cadastrar'}
        </Button>
      </form>
      <div className="text-sm text-center">
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">
          Já tenho conta
        </Link>
      </div>
    </div>
  );
}
