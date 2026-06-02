'use client';

import { type FormEvent } from 'react';
import Link from 'next/link';
import { FolderOpen, ArrowRight, Sparkles, Phone } from 'lucide-react';
import { Composer, type ChatAttachment } from './Composer';
import { AssistantLauncher } from './AssistantLauncher';
import { OnboardingQuickStartCard } from './OnboardingQuickStartCard';

// 2B Supply contact CTA — surfaces in the empty state as a "got value
// from this? talk to us" handoff. tel: link for click-to-call on mobile;
// desktop falls back to opening the OS dialer.
const CONTACT_TEL_HREF = 'tel:+5521999792912';
const CONTACT_PHONE_DISPLAY = '(21) 99979-2912';

type Props = {
  // Composer props piped through — we own the single Composer instance
  // here so the user goes straight from typing → submitting from the hero
  // input without an extra hop.
  input: string;
  onChange: (value: string) => void;
  onSubmit: (e?: FormEvent, attachment?: ChatAttachment) => void;
  isLoading: boolean;
  onStop: () => void;
  /** Optional ActiveProfileChip slot rendered below the composer. */
  profileChip?: React.ReactNode;
};

export function EmptyState({
  input,
  onChange,
  onSubmit,
  isLoading,
  onStop,
  profileChip,
}: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8">
        {/* Hero pitch — action-oriented; positions ProcurementGPT as a
            focused supply-chain tool, not a generic chat. */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-start gap-3">
            <Sparkles
              className="h-6 w-6 text-brand flex-shrink-0 mt-1"
              aria-hidden="true"
            />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-snug">
              Sua IA de Suprimentos está pronta.
              <br />
              <span className="text-brand">Qual problema vamos resolver?</span>
            </h1>
          </div>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl">
            Compras, contratos, fornecedores, estoque ou logística. Por onde
            começamos?
          </p>
        </div>

        {/* Composer hero — centered, pill-card */}
        <div className="w-full">
          <Composer
            input={input}
            onChange={onChange}
            onSubmit={onSubmit}
            isLoading={isLoading}
            onStop={onStop}
            variant="hero"
            placeholder="Pergunte alguma coisa…"
          />
        </div>

        {/* Active profile chip + personalize CTA — paired on the same row.
            The chip picks an existing Perfil for this session; the link
            opens the creation flow with a brief explanation of what
            Perfis do for the chat. */}
        <div className="w-full flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {profileChip}
          <Link
            href="/assistants/profile"
            className="group inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span>
              Personalize criando um{' '}
              <span className="text-brand font-medium">Perfil da Categoria</span>
              <span className="text-muted-foreground/80">
                {' '}
                — direciona as respostas para o seu contexto
              </span>
            </span>
            <ArrowRight
              className="h-3 w-3 flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
              aria-hidden="true"
            />
          </Link>
        </div>

        {/* Assistant launcher — destaque dos 8 assistentes (feedback de
            usuário). Fica acima dos chat-starters porque a maior parte
            do valor da plataforma está nos assistentes. */}
        <div className="w-full">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 text-center">
            Vá direto pro assistente
          </div>
          <AssistantLauncher variant="hero" />
        </div>

        {/* Onboarding quick-win — só pra quem ainda não dispensou (1ª visita).
            Leva aos 3 caminhos de "aha" mais rápidos. */}
        <OnboardingQuickStartCard />

        {/* 2B Supply contact CTA — handoff to a real human when the IA
            doesn't cover it (or for sales/onboarding). Tel link works
            on mobile + desktop softphones. */}
        <a
          href={CONTACT_TEL_HREF}
          className="group inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-brand/30 bg-brand/5 hover:bg-brand/10 hover:border-brand/50 px-5 py-3 transition-all duration-300 active:scale-[0.99]"
        >
          <span className="text-sm text-muted-foreground">
            Gostou da IA de Compras?
          </span>
          <span className="hidden sm:inline text-muted-foreground/40">·</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            Fale com a <span className="text-brand">2B Supply</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {CONTACT_PHONE_DISPLAY}
          </span>
          <ArrowRight
            className="h-3.5 w-3.5 text-brand group-hover:translate-x-0.5 transition-transform"
            aria-hidden="true"
          />
        </a>
      </div>
    </div>
  );
}
