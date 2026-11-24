'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';

import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { Botao, CAMPO, ROTULO } from './ui';

// Primeiro acesso do médico (sub-projeto 106): ele entrou com a senha
// temporária que a 2B Supply passou e precisa criar a dele antes de usar.

export function PrimeiraSenha() {
  const [senha, setSenha] = useState('');
  const [repete, setRepete] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (senha.length < 8) return setErro('Use pelo menos 8 caracteres.');
    if (senha !== repete) return setErro('As duas senhas não estão iguais.');
    setErro('');
    setSalvando(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: senha, data: { trocar_senha: false } });
    if (error) {
      setSalvando(false);
      return setErro(/different from the old|same/i.test(error.message) ? 'Escolha uma senha diferente da temporária.' : 'Não foi possível salvar. Tente uma senha mais forte.');
    }
    window.location.href = '/area-medica';
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
      <KeyRound className="h-8 w-8 text-brand" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold">Crie a sua senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">Você entrou com a senha temporária. Escolha agora a sua: só você vai saber, e é com ela que você entra daqui para a frente.</p>
      <form
        className="mt-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <label className="block">
          <span className={ROTULO}>Nova senha</span>
          <input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={CAMPO} />
        </label>
        <label className="block">
          <span className={ROTULO}>Repita a nova senha</span>
          <input type="password" autoComplete="new-password" value={repete} onChange={(e) => setRepete(e.target.value)} className={CAMPO} />
        </label>
        {erro && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{erro}</p>}
        <Botao ocupado={salvando} onClick={salvar}>
          Salvar e entrar
        </Botao>
      </form>
    </div>
  );
}
