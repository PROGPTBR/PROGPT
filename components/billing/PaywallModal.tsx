'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, X } from 'lucide-react';

// Sub-projeto 27 — modal exibido quando user free recebe 402 ao tentar
// uma 2ª execução de um assistente. Reutilizável em todos os assistant
// pages.

type Props = {
  assistantType: string;
  onClose: () => void;
};

const TYPE_LABELS: Record<string, string> = {
  rfp: 'RFP',
  kraljic: 'análise Kraljic',
  porter: 'análise Porter',
  financial: 'análise financeira',
  abc: 'curva ABC',
  profile: 'perfil de categoria',
  negotiation: 'simulação de negociação',
};

export function PaywallModal({ assistantType, onClose }: Props) {
  const label = TYPE_LABELS[assistantType] ?? 'assistente';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex items-start gap-3">
          <Sparkles
            className="h-6 w-6 text-brand mt-1 flex-shrink-0"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">
              Você já usou sua {label} grátis
            </h2>
            <p className="text-sm text-muted-foreground">
              Cada conta free tem 1 execução grátis de cada assistente pra
              experimentar. Pra continuar usando, faça upgrade pro Pro.
            </p>
          </div>
        </div>

        <div className="rounded-xl border-2 border-brand bg-brand/5 p-4 space-y-2">
          <div className="text-xs uppercase tracking-wider text-brand font-semibold">
            Plano Pro
          </div>
          <div className="text-2xl font-semibold">
            R$ 127,99<span className="text-sm font-normal text-muted-foreground">/mês</span>
          </div>
          <ul className="text-sm text-foreground/90 space-y-1 pt-1">
            <li>✓ Todos os 7 assistentes ilimitados</li>
            <li>✓ Geração ilimitada de .docx e .xlsx</li>
            <li>✓ Cancele quando quiser</li>
          </ul>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-border bg-background hover:bg-accent h-10 text-sm transition-colors"
          >
            Agora não
          </button>
          <Link
            href="/pricing"
            className="flex-1 rounded-full bg-brand text-black hover:bg-brand/90 h-10 leading-10 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
          >
            Ver planos
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
