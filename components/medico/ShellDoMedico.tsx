'use client';

import { useState } from 'react';
import { LogOut, Stethoscope } from 'lucide-react';

import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { TemaClaro } from './TemaClaro';

// Moldura da conta de médico (sub-projetos 105 e 110): só a Área Médica, no
// formato de aplicativo. Cabeçalho azul colado no topo e conteúdo de borda a
// borda no celular, sem o menu do sistema de compras.

export function ShellDoMedico({ children }: { children: React.ReactNode }) {
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await supabaseBrowser().auth.signOut().catch(() => undefined);
    window.location.href = '/medicos';
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased [scrollbar-width:thin] sm:bg-[#f6f8fc]">
      <TemaClaro />
      <header className="sticky top-0 z-30 bg-medico-escuro text-white">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-5 sm:px-8">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Stethoscope className="h-5 w-5" aria-hidden /> Área Médica
          </span>
          <button type="button" onClick={sair} disabled={saindo} aria-label="Sair" title="Sair" className="rounded-full p-2 text-white/80 hover:bg-white/15 hover:text-white">
            <LogOut className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] bg-white pt-5 sm:px-0 sm:shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">{children}</main>
    </div>
  );
}
