'use client';

import { useState } from 'react';
import { LogOut, Stethoscope } from 'lucide-react';

import { supabaseBrowser } from '@/lib/db/supabase-browser';

// Moldura da conta de médico (sub-projeto 105): só a Área Médica. Sem o menu
// do resto do sistema (chat, assistentes, assinatura), que essa conta não usa.

export function ShellDoMedico({ children }: { children: React.ReactNode }) {
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await supabaseBrowser().auth.signOut().catch(() => undefined);
    window.location.href = '/medicos';
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Stethoscope className="h-5 w-5 text-brand" aria-hidden /> Área Médica
          </span>
          <button type="button" onClick={sair} disabled={saindo} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1800px] px-4 pb-12 pt-6 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
