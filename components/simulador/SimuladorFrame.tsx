'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, ExternalLink, RotateCw } from 'lucide-react';

// Moldura do Simulador Tributário. O simulador é um bundle React auto-contido
// (/simulador-sn-reforma.html) embutido via <iframe>. Aqui damos a ele o máximo
// de tela possível + botão de tela cheia real (Fullscreen API) e recarregar,
// tudo com o visual do projeto (panel + tokens).
export function SimuladorFrame() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFs, setIsFs] = useState(false);

  // Sincroniza o estado com o ciclo real do fullscreen (inclui saída via Esc).
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === wrapperRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await wrapperRef.current?.requestFullscreen();
      }
    } catch {
      // Fullscreen bloqueado pelo browser/policy — silencioso, fail-soft.
    }
  }, []);

  const reload = useCallback(() => {
    const el = iframeRef.current;
    if (el) el.src = el.src; // remonta o simulador (limpa o estado do form)
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`panel flex min-h-0 flex-col overflow-hidden p-0 ${
        isFs ? 'h-screen w-screen rounded-none' : 'h-full'
      }`}
    >
      {/* Barra de ferramentas — visual do projeto */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">
            Simulador Tributário
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            Simples Nacional × Reforma (IBS/CBS)
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={reload}
            title="Reiniciar simulação"
            aria-label="Reiniciar simulação"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </button>
          <a
            href="/simulador-sn-reforma.html"
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir em nova aba"
            aria-label="Abrir em nova aba"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFs ? 'Sair da tela cheia' : 'Tela cheia'}
            aria-label={isFs ? 'Sair da tela cheia' : 'Tela cheia'}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-brand-gradient-soft"
          >
            {isFs ? (
              <>
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sair</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Tela cheia</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* O simulador — preenche todo o espaço restante da moldura */}
      <iframe
        ref={iframeRef}
        src="/simulador-sn-reforma.html"
        title="Simulador SN x Reforma"
        className="min-h-0 w-full flex-1 block bg-white"
      />
    </div>
  );
}
