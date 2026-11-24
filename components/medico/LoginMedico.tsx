'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { LEGAL_CONTACT_PHONE_TEL } from '@/lib/legal/constants';
import { Botao, CAMPO, ROTULO } from './ui';

// Login da Área Médica (sub-projeto 107). É um produto à parte: aqui só entra
// o médico, com e-mail e senha. Sem "criar conta" (o acesso é liberado pela 2B
// Supply), sem planos e sem nenhum caminho para o sistema de compras.

const AJUDA = `https://wa.me/${LEGAL_CONTACT_PHONE_TEL.replace(/\D/g, '')}?text=${encodeURIComponent('Olá. Preciso de ajuda para entrar na Área Médica.')}`;

export function LoginMedico() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar() {
    if (!email.trim() || !senha) return setErro('Informe o e-mail e a senha.');
    setErro('');
    setEntrando(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      setEntrando(false);
      return setErro(/invalid login|credentials/i.test(error.message) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar agora. Tente de novo em instantes.');
    }
    // Recarrega para o servidor enxergar a sessão nova.
    window.location.href = '/area-medica';
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void entrar();
      }}
    >
      <label className="block">
        <span className={ROTULO}>E-mail</span>
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={`${CAMPO} h-11`} />
      </label>
      <label className="block">
        <span className={ROTULO}>Senha</span>
        <span className="relative block">
          <input type={mostrar ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={`${CAMPO} h-11 pr-11`} />
          <button type="button" onClick={() => setMostrar((v) => !v)} aria-label={mostrar ? 'Esconder a senha' : 'Mostrar a senha'} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground">
            {mostrar ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </span>
      </label>
      {erro && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {erro}
        </p>
      )}
      <div className="[&>button]:h-11 [&>button]:w-full [&>button]:justify-center">
        <Botao ocupado={entrando} onClick={entrar}>
          Entrar
        </Botao>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Primeiro acesso ou esqueceu a senha?{' '}
        <a href={AJUDA} target="_blank" rel="noreferrer" className="font-medium text-medico hover:underline">
          Fale com a gente
        </a>
      </p>
    </form>
  );
}
