'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { INPUT_CLASS, LABEL_CLASS, ERROR_CLASS, SUBMIT_CLASS } from '@/components/auth/constants';

type Props = {
  token: string;
  email: string;
  inviterName: string | null;
  inviterEmail: string | null;
};

export function AcceptInviteForm({ token, email, inviterName, inviterEmail }: Props) {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneExisting, setDoneExisting] = useState(false);

  const who = (inviterName || inviterEmail || 'Sua empresa').trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (password.length < 8) {
      setError('Escolha uma senha com pelo menos 8 caracteres.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch(`/api/convite/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, fullName }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: boolean;
      };

      if (!res.ok) {
        setError(data.error || 'Não foi possível concluir. Tente de novo.');
        setBusy(false);
        return;
      }

      // Conta já existia: a senha dela não foi alterada, então não dá pra
      // entrar com a que a pessoa digitou aqui — mandamos pro login.
      if (!data.created) {
        setDoneExisting(true);
        setBusy(false);
        return;
      }

      const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Acesso está liberado mesmo assim — só o login automático falhou.
        setDoneExisting(true);
        setBusy(false);
        return;
      }

      router.push('/chat');
      router.refresh();
    } catch {
      setError('Não foi possível concluir. Verifique sua conexão e tente de novo.');
      setBusy(false);
    }
  }

  if (doneExisting) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center space-y-3">
        <h1 className="text-xl font-semibold">Acesso liberado ✅</h1>
        <p className="text-sm text-muted-foreground">
          Seu acesso a <strong>{email}</strong> já está ativo. Entre com seu e-mail e senha para
          começar.
        </p>
        <a href="/login" className={`${SUBMIT_CLASS} !w-auto px-6`}>
          Ir para o login
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Seu acesso ao PROGPT</h1>
        <p className="text-sm text-muted-foreground">
          <strong>{who}</strong> reservou um acesso para você. Crie sua senha para entrar — sem
          cartão, a assinatura é da empresa.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={LABEL_CLASS}>E-mail</label>
          <input className={`${INPUT_CLASS} opacity-70`} value={email} readOnly disabled />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="invite-name">
            Seu nome
          </label>
          <input
            id="invite-name"
            className={INPUT_CLASS}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Como você quer ser chamado"
            autoComplete="name"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="invite-password">
            Crie uma senha
          </label>
          <input
            id="invite-password"
            type="password"
            className={INPUT_CLASS}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo de 8 caracteres"
            autoComplete="new-password"
          />
        </div>

        {error && <div className={ERROR_CLASS}>{error}</div>}

        <button type="submit" className={SUBMIT_CLASS} disabled={busy}>
          {busy ? 'Liberando acesso…' : 'Criar senha e entrar'}
        </button>
      </form>

      <p className="text-xs text-muted-foreground text-center">
        Já tem conta com este e-mail? Pode criar a senha mesmo assim — vamos apenas vincular o
        acesso e manter sua senha atual.
      </p>
    </div>
  );
}
