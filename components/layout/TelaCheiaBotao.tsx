'use client';

import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

// Botão "Tela cheia" das telas de trabalho (assistentes): a análise ocupa a
// tela inteira do computador. Esc também sai. (Pedido de cliente 2026-10-08:
// "a tela está muito pequena, dê a opção de tela cheia".)
export function TelaCheiaBotao() {
  const [cheia, setCheia] = useState(false);

  useEffect(() => {
    const aoMudar = () => setCheia(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);

  async function alternar() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* navegador bloqueou a tela cheia: segue normal */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void alternar()}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {cheia ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
      {cheia ? 'Sair da tela cheia' : 'Tela cheia'}
    </button>
  );
}
