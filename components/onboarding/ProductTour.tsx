'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { placeCard, type Rect, type TourStep } from '@/lib/onboarding/tour-steps';
import { TOUR_ABA_EVENT } from '@/lib/onboarding/tour-state';

// Tour guiado com foco recortado: um retângulo transparente sobre o elemento
// real e o resto da tela escurecido por uma sombra de espalhamento gigante —
// sem biblioteca e sem clonar o elemento.
//
// Componente CONTROLADO (sub-projeto 70): quem guarda o passo atual é o
// <TourHost/> do layout raiz, porque o tour navega entre páginas e esta
// árvore é desmontada a cada troca de rota.
//
// Muitas telas desenham o conteúdo só depois de carregar dados. Por isso o
// alvo é procurado por até ESPERA_ALVO_MS antes de desistir; não achou, o
// passo cai no cartão centrado — o tour nunca fica preso.

const CARD_WIDTH = 360;
const ESPERA_ALVO_MS = 3000;
const INTERVALO_BUSCA_MS = 150;

export function ProductTour({
  step,
  index,
  total,
  navegando = false,
  onNext,
  onBack,
  onFinish,
}: {
  step: TourStep;
  index: number;
  total: number;
  /** A página do passo ainda está abrindo. */
  navegando?: boolean;
  onNext: () => void;
  onBack: () => void;
  /** Chamado ao concluir E ao pular — os dois encerram o tour para sempre. */
  onFinish: (reason: 'concluido' | 'pulado') => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [procurando, setProcurando] = useState(false);
  const [cardSize, setCardSize] = useState({ width: CARD_WIDTH, height: 220 });

  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const isLast = index === total - 1;

  // Acha o alvo (esperando a página carregar), traz para a área visível uma
  // vez e passa a acompanhar a geometria dele.
  useEffect(() => {
    if (navegando) return;

    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelado = false;
    const inicio = Date.now();

    const medir = () => {
      const el = step.target ? document.querySelector(step.target) : null;
      const r = el?.getBoundingClientRect();
      // Elemento presente mas sem área (display:none num pai) conta como ausente.
      setRect(r && r.width && r.height ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
    };

    const agendar = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(medir);
    };

    const procurar = () => {
      if (cancelado) return;
      const el = step.target ? document.querySelector(step.target) : null;
      const r = el?.getBoundingClientRect();
      const visivel = !!(r && r.width && r.height);
      // Passo dentro de uma aba da tela: pede a aba enquanto o alvo não aparece.
      // Repetir cobre a tela que ainda está montando quando o tour chega.
      if (step.aba && !visivel) {
        window.dispatchEvent(new CustomEvent(TOUR_ABA_EVENT, { detail: step.aba }));
      }
      if (step.target && !visivel && Date.now() - inicio < ESPERA_ALVO_MS) {
        timer = setTimeout(procurar, INTERVALO_BUSCA_MS);
        return;
      }
      if (visivel) el?.scrollIntoView({ block: 'center', inline: 'nearest' });
      setProcurando(false);
      medir();
    };

    setProcurando(!!step.target);
    setRect(null);
    // Sempre pede a aba ao entrar no passo — inclusive quando o alvo é comum a
    // todas as abas (cabeçalho da vitrine), para "Voltar" não deixar a tela
    // presa na aba do passo seguinte.
    if (step.aba) window.dispatchEvent(new CustomEvent(TOUR_ABA_EVENT, { detail: step.aba }));
    procurar();
    window.addEventListener('resize', agendar);
    window.addEventListener('scroll', agendar, true);

    return () => {
      cancelado = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', agendar);
      window.removeEventListener('scroll', agendar, true);
    };
  }, [navegando, index, step.target, step.aba]);

  const carregando = navegando || procurando;

  // O cartão só tem altura depois de renderizar — medir aqui evita o pulo.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCardSize((prev) =>
      Math.abs(prev.height - r.height) < 1 && Math.abs(prev.width - r.width) < 1
        ? prev
        : { width: r.width, height: r.height },
    );
  }, [index, rect, carregando]);

  useEffect(() => {
    if (!carregando) nextRef.current?.focus();
  }, [index, carregando]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onFinish('pulado');
        return;
      }
      if (carregando) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!isLast) onNext();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (index > 0) onBack();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [carregando, index, isLast, onBack, onFinish, onNext]);

  const pos =
    typeof window === 'undefined'
      ? { top: 0, left: 0 }
      : placeCard(
          carregando ? null : rect,
          { width: window.innerWidth, height: window.innerHeight },
          cardSize,
        );

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Bloqueia a tela por trás. O recorte abaixo pinta o escurecimento. */}
      <div className="absolute inset-0" aria-hidden="true" />

      {rect && !carregando ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-brand/70 transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.72)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-slate-950/72" />
      )}

      <div
        ref={cardRef}
        className="absolute w-[min(22.5rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-5 shadow-2xl"
        style={{ top: pos.top, left: pos.left }}
      >
        <button
          type="button"
          onClick={() => onFinish('pulado')}
          aria-label="Fechar tour"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="pr-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
          {step.secao ? `${step.secao} · ` : ''}Passo {index + 1} de {total}
        </div>

        <h2 id="tour-title" className="mt-1 pr-7 text-base font-semibold text-foreground">
          {step.title}
        </h2>

        {carregando ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Abrindo a tela…
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        )}

        <div
          className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
        >
          <div
            className="h-full rounded-full bg-brand-gradient transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onFinish('pulado')}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Pular tour
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={onBack}
                disabled={carregando}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                Voltar
              </button>
            )}

            <button
              ref={nextRef}
              type="button"
              onClick={() => (isLast ? onFinish('concluido') : onNext())}
              disabled={carregando}
              className="inline-flex h-9 items-center rounded-lg bg-brand-gradient px-4 text-sm font-semibold text-black transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
            >
              {isLast ? 'Começar a usar' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
