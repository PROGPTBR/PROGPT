'use client';

import { type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';

import {
  Composer,
  type ChatAttachment,
} from './Composer';

import { OnboardingQuickStartCard } from './OnboardingQuickStartCard';

type Props = {
  // Composer props piped through — we own the single Composer instance
  // here so the user goes straight from typing → submitting from the hero
  // input without an extra hop.
  input: string;

  onChange: (value: string) => void;

  onSubmit: (
    e?: FormEvent,
    attachment?: ChatAttachment
  ) => void;

  isLoading: boolean;

  onStop: () => void;

  onVoiceMode?: () => void;

  /** Assistente Pessoal — passthrough pro Composer interno. */
  personalMode?: boolean;
  onTogglePersonalMode?: () => void;
  placeholder?: string;
};

export function EmptyState({
  input,
  onChange,
  onSubmit,
  isLoading,
  onStop,
  onVoiceMode,
  personalMode,
  onTogglePersonalMode,
  placeholder,
}: Props) {
  return (
    <div className="relative flex-1 flex flex-col items-center px-6 py-8 overflow-y-auto">
      {/* Ambient brand backdrop */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 brand-aura"
        aria-hidden="true"
      />

      {/* Conteúdo principal */}
      <div className="relative my-auto w-full max-w-2xl flex flex-col items-center gap-8">
        {/* Hero */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-start gap-3">
            <Sparkles
              className="h-6 w-6 text-brand flex-shrink-0 mt-1"
              aria-hidden="true"
            />

            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-snug">
              Sua IA de Suprimentos está pronta.
              <br />

              <span className="text-brand-gradient">
                Por onde começamos?
              </span>
            </h1>
          </div>
        </div>

        {/* Composer principal */}
        <div className="w-full">
          <Composer
            input={input}
            onChange={onChange}
            onSubmit={onSubmit}
            isLoading={isLoading}
            onStop={onStop}
            variant="hero"
            placeholder={placeholder ?? 'Escreva a sua dúvida'}
            onVoiceMode={onVoiceMode}
            personalMode={personalMode}
            onTogglePersonalMode={onTogglePersonalMode}
          />
        </div>

        {/* Aviso */}
        <p className="max-w-xl text-center text-sm text-muted-foreground/40">
          O ProGPT pode cometer erros. Verifique informações importantes.
        </p>

        {/* Onboarding quick-win */}
        <OnboardingQuickStartCard />
      </div>
    </div>
  );
}