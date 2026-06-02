'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Factory, BarChart3, FileText, ArrowRight, Rocket } from 'lucide-react';

// "Comece por aqui" — card de onboarding dismissível no empty-state do chat.
// Leva o usuário novo aos 3 caminhos de "aha" mais rápidos (busca de
// fornecedor → ABC → RFP). Dismissão persiste em localStorage (mesmo padrão
// de CookieConsent — `procurementgpt_*`), sem migration. Some quando o usuário
// começa a conversar (o EmptyState desmonta) e some pra sempre ao dispensar.
const ONBOARDING_KEY = 'procurementgpt_onboarding_quick_start_v1';

const STEPS = [
  {
    n: 1,
    label: 'Ache fornecedores reais',
    hint: 'Busca por CNAE/região em 124 mil empresas + export CSV',
    href: '/assistants/suppliers',
    Icon: Factory,
  },
  {
    n: 2,
    label: 'Rode uma Curva ABC',
    hint: 'Pareto do seu spend + plano por classe A/B/C',
    href: '/assistants/abc',
    Icon: BarChart3,
  },
  {
    n: 3,
    label: 'Gere um RFP',
    hint: 'Documento .docx + planilha de cotação pronta',
    href: '/assistants/rfp',
    Icon: FileText,
  },
] as const;

export function OnboardingQuickStartCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) setVisible(true);
    } catch {
      setVisible(true); // private mode → mostra por padrão
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(ONBOARDING_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="w-full rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 to-brand/[0.04] px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-brand flex-shrink-0" aria-hidden="true" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">
              Comece por aqui
            </div>
            <div className="text-sm font-semibold text-foreground">
              3 passos pra ver valor em minutos
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar dica de boas-vindas"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors active:scale-95"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {STEPS.map(({ n, label, hint, href, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-1 rounded-xl border border-brand/20 bg-card/60 hover:bg-brand/10 hover:border-brand/50 px-3 py-2.5 transition-all duration-300 active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20 text-[10px] font-bold text-brand">
                {n}
              </span>
              <Icon className="h-4 w-4 text-brand" aria-hidden="true" />
              <ArrowRight
                className="ml-auto h-3.5 w-3.5 text-brand/70 group-hover:translate-x-0.5 transition-transform"
                aria-hidden="true"
              />
            </div>
            <div className="text-xs font-medium text-foreground leading-tight">
              {label}
            </div>
            <div className="text-[11px] text-muted-foreground leading-snug">
              {hint}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
