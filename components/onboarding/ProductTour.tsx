'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { TOUR_STEPS, placeCard, type Rect, type TourStep } from '@/lib/onboarding/tour-steps';

// Tour guiado com foco recortado: um retângulo transparente sobre o elemento
// real e o resto da tela escurecido por uma sombra de espalhamento gigante —
// sem biblioteca e sem clonar o elemento.
//
// Passo cujo alvo não existe na tela (sidebar recolhida, celular com a gaveta
// fechada) cai no cartão centrado, então o tour nunca fica preso.

const CARD_WIDTH = 360;

export function ProductTour({
  open,
  onFinish,
  steps = TOUR_STEPS,
}: {
  open: boolean;
  /** Chamado ao concluir E ao pular — os dois encerram o tour para sempre. */
  onFinish: (reason: 'concluido' | 'pulado') => void;
  steps?: TourStep[];
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardSize, setCardSize] = useState({ width: CARD_WIDTH, height: 220 });

  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Recomeça do zero sempre que o tour é reaberto.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const finish = useCallback(
    (reason: 'concluido' | 'pulado') => {
      onFinish(reason);
    },
    [onFinish],
  );

  // Traz o alvo para a área visível uma vez por passo. Separado da medição
  // para não entrar em laço: rolar dispara o listener, que mediria de novo.
  useEffect(() => {
    if (!open || !step?.target) return;
    document
      .querySelector(step.target)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [open, step?.target]);

  // Mede o alvo e reage a tudo que muda a geometria da página.
  useEffect(() => {
    if (!open) return;

    let frame = 0;

    const measure = () => {
      if (!step?.target) {
        setRect(null);
        return;
      }
      const el = document.querySelector(step.target);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      // Elemento presente mas sem área (display:none num pai) conta como ausente.
      setRect(r.width && r.height ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [open, index, step?.target]);

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
  }, [open, index, rect]);

  useEffect(() => {
    if (open) nextRef.current?.focus();
  }, [open, index]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish('pulado');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex((i) => (i === steps.length - 1 ? i : i + 1));
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => (i === 0 ? i : i - 1));
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, steps.length, finish]);

  if (!open || !step) return null;

  const pos =
    typeof window === 'undefined'
      ? { top: 0, left: 0 }
      : placeCard(
          rect,
          { width: window.innerWidth, height: window.innerHeight },
          cardSize,
        );

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Bloqueia a tela por trás. O recorte abaixo pinta o escurecimento. */}
      <div className="absolute inset-0" aria-hidden="true" />

      {rect ? (
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
          onClick={() => finish('pulado')}
          aria-label="Fechar tour"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
          Passo {index + 1} de {steps.length}
        </div>

        <h2 id="tour-title" className="mt-1 pr-7 text-base font-semibold text-foreground">
          {step.title}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        <div
          className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
        >
          <div
            className="h-full rounded-full bg-brand-gradient transition-all duration-300"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => finish('pulado')}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Pular tour
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                Voltar
              </button>
            )}

            <button
              ref={nextRef}
              type="button"
              onClick={() => (isLast ? finish('concluido') : setIndex((i) => i + 1))}
              className="inline-flex h-9 items-center rounded-lg bg-brand-gradient px-4 text-sm font-semibold text-black transition-all hover:brightness-110 active:scale-95"
            >
              {isLast ? 'Começar a usar' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
