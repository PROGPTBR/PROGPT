'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { Button } from '@/components/ui/button';

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
    <div className="w-full max-w-sm mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use seu email e senha para acessar.
        </p>
      </div>
      <form onSubmit={onPasswordSubmit} className="space-y-3">
        <div>
          <label htmlFor="email" className="block text-sm mb-1">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm mb-1">Senha</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        {error ? (
          <div role="alert" className="text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <div className="text-sm text-center space-y-2">
        <div>
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">
            Criar conta
          </Link>
        </div>
        <div>
          <Link href="/forgot-password" className="text-muted-foreground hover:underline">
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </div>
  );
}
