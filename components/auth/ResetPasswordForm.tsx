'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

function friendlyPasswordError(error: { message?: string; code?: string }): string {
  if (
    error.code === 'weak_password' ||
    error.message?.toLowerCase().includes('known to be weak')
  ) {
    return 'A senha é conhecida por ser fraca e fácil de adivinhar; por favor, escolha uma mais difícil.';
  }
  if (error.message?.toLowerCase().includes('new password should be different')) {
    return 'A nova senha deve ser diferente da senha anterior.';
  }
  return error.message ?? 'Algo deu errado. Tente novamente.';
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabaseBrowser();

      // O link de recuperação chega de formas diferentes conforme o flow do
      // Supabase: (a) tokens no HASH `#access_token=...` (implícito — padrão
      // hoje), (b) `?code=...` (PKCE), ou (c) erro `?error=/#error=` (link
      // expirado/usado). Tratamos os três explicitamente e sem corrida.
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      const errDesc =
        url.searchParams.get('error_description') || hash.get('error_description');
      if (errDesc) {
        if (active) setLinkError(errDesc.replace(/\+/g, ' '));
        if (active) setHasSession(false);
        return;
      }

      let recoveredSession = null;

      // O pedido de reset é enviado no servidor por um cliente supabase-js
      // comum, portanto pode voltar no fluxo implícito. O browser client do
      // @supabase/ssr usa PKCE por padrão e não devemos depender de ele consumir
      // automaticamente um fragmento implícito.
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      if (accessToken && refreshToken) {
        const { data, error: sessionError } = await sb.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          if (active) setLinkError(sessionError.message);
          if (active) setHasSession(false);
          return;
        }
        recoveredSession = data.session;
        window.history.replaceState(null, '', `${url.pathname}${url.search}`);
      }

      // PKCE: troca explícita do código quando esse for o fluxo recebido.
      const code = url.searchParams.get('code');
      if (!recoveredSession && code) {
        const { data, error: exchangeError } = await sb.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setLinkError(exchangeError.message);
          if (active) setHasSession(false);
          return;
        }
        recoveredSession = data.session;
      }

      let session = recoveredSession ?? (await sb.auth.getSession()).data.session;
      if (!session) {
        // pequena folga pro detectSessionInUrl terminar em navegadores lentos
        await new Promise((r) => setTimeout(r, 250));
        session = (await sb.auth.getSession()).data.session;
      }
      if (active) setHasSession(!!session);
    })();
    return () => { active = false; };
  }, []);

  if (hasSession === null) {
    return (
      <div className="space-y-4 text-center" role="status">
        <h1 className="text-2xl font-semibold tracking-tight">
          Validando link <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground">Aguarde um instante.</p>
      </div>
    );
  }

  if (hasSession === false) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Link expirado <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {linkError
            ? 'Este link de recuperação expirou ou já foi usado. Solicite um novo.'
            : 'Sua sessão de recuperação não está mais ativa. Abra o link direto do e-mail (sem copiar) e no mesmo navegador.'}
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
      setError(friendlyPasswordError(err));
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
        <div className="relative">
          <input
            id="pwd"
            type={showPwd ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="w-full rounded-lg bg-muted/40 border border-border px-4 py-2.5 pr-11 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPwd((visible) => !visible)}
            aria-label={showPwd ? 'Ocultar nova senha' : 'Mostrar nova senha'}
            title={showPwd ? 'Ocultar nova senha' : 'Mostrar nova senha'}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPwd ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <div>
        <label
          htmlFor="confirm"
          className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
        >
          Confirmar nova senha
        </label>
        <div className="relative">
          <input
            id="confirm"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg bg-muted/40 border border-border px-4 py-2.5 pr-11 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((visible) => !visible)}
            aria-label={showConfirm ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'}
            title={showConfirm ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showConfirm ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
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
