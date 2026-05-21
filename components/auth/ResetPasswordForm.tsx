'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

export function ResetPasswordForm() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
    });
  }, []);

  if (hasSession === false) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Link expirado <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Sua sessão de recuperação não está mais ativa.
        </p>
        <Link
          href="/forgot-password"
          className="text-brand hover:text-brand/80 transition-colors text-sm inline-block pt-2"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pwd !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    const sb = supabaseBrowser();
    const { error: err } = await sb.auth.updateUser({ password: pwd });
    setLoading(false);
    if (err) {
      setError(err.message ?? 'Algo deu errado. Tente novamente.');
      return;
    }
    router.push('/chat');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Redefinir senha <span className="text-brand">.</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Escolha uma nova senha para sua conta.
        </p>
      </div>
      <div>
        <label
          htmlFor="pwd"
          className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
        >
          Nova senha
        </label>
        <input
          id="pwd"
          type="password"
          required
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          className="w-full rounded-lg bg-muted/40 border border-border px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
        />
      </div>
      <div>
        <label
          htmlFor="confirm"
          className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
        >
          Confirmar nova senha
        </label>
        <input
          id="confirm"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg bg-muted/40 border border-border px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
        />
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center bg-brand text-black h-11 rounded-full text-sm font-medium hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {loading ? 'Redefinindo…' : 'Redefinir'}
      </button>
    </form>
  );
}
