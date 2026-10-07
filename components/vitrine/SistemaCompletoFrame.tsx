'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, RotateCw } from 'lucide-react';

import { SISTEMAS_COMPLETOS, type SistemaCompleto } from '@/lib/vitrine/sistema-completo';

// Moldura do sistema completo de demonstração (sub-projeto 74) — mesmo
// desenho do SimuladorFrame: barra do PROGPT em cima, sistema embutido via
// <iframe> ocupando o resto, tela cheia real e abrir em nova aba.
export function SistemaCompletoFrame({ sistema }: { sistema: SistemaCompleto }) {
  const { titulo, subtitulo, src } = SISTEMAS_COMPLETOS[sistema];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === wrapperRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapperRef.current?.requestFullscreen();
    } catch {
      // Fullscreen bloqueado pelo navegador — segue sem.
    }
  }, []);

  const reload = useCallback(() => {
    const el = iframeRef.current;
    if (el) el.src = src;
  }, [src]);

  const botao =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';

  return (
    <div
      ref={wrapperRef}
      className={`panel flex min-h-0 flex-col overflow-hidden p-0 ${isFs ? 'h-screen w-screen rounded-none' : 'h-full'}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
        <h1 className="truncate text-sm font-semibold text-foreground">
          {titulo}
          <span className="ml-2 font-normal text-muted-foreground">{subtitulo}</span>
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={reload} title="Voltar ao início" aria-label="Voltar ao início" className={botao}>
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </button>
          <a href={src} target="_blank" rel="noopener noreferrer" title="Abrir em nova aba" aria-label="Abrir em nova aba" className={botao}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFs ? 'Sair da tela cheia' : 'Tela cheia'}
            aria-label={isFs ? 'Sair da tela cheia' : 'Tela cheia'}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-brand-gradient-soft"
          >
            {isFs ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
            <span className="hidden sm:inline">{isFs ? 'Sair' : 'Tela cheia'}</span>
          </button>
        </div>
      </div>

      <iframe ref={iframeRef} src={src} title={titulo} className="block min-h-0 w-full flex-1 bg-white" />
    </div>
  );
}
