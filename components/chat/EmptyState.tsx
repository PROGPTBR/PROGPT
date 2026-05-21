'use client';

import { type FormEvent } from 'react';
import Link from 'next/link';
import { FolderOpen, ArrowRight, Sparkles } from 'lucide-react';
import { Composer, type ChatAttachment } from './Composer';

// Suggestion pills (Claude/ChatGPT style) — aligned to the five
// procurement areas mentioned in the hero pitch. Each pill pre-fills the
// composer with a concrete starter question so the user goes from
// landing → typing in one click.
type Suggestion = { label: string; query: string };

const SUGGESTIONS: Suggestion[] = [
  {
    label: 'Compras',
    query:
      'Como definir a estratégia de compras para uma categoria nova?',
  },
  {
    label: 'Contratos',
    query:
      'Como estruturar um contrato de fornecimento com SLA e penalidades?',
  },
  {
    label: 'Fornecedores',
    query:
      'Como avaliar a saúde financeira de um fornecedor antes de fechar?',
  },
  {
    label: 'Estoque',
    query:
      'Como calcular estoque mínimo e ponto de pedido via curva ABC?',
  },
  {
    label: 'Logística',
    query:
      'Como otimizar custos de inbound em uma rede multi-CD?',
  },
];

const LIBRARY_OVERVIEW_QUERY = 'Sobre o que você pode me ensinar?';

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
              <span className="text-brand">Qual problema vamos atacar?</span>
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

        {profileChip && (
          <div className="w-full flex justify-center">{profileChip}</div>
        )}

        {/* Suggestion pills — the five areas the hero mentioned, plus a
            Descobrir pill that surfaces the library overview. */}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => onChange(LIBRARY_OVERVIEW_QUERY)}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/5 hover:bg-brand/10 px-3.5 h-9 text-xs font-medium text-brand transition-all duration-300 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Descobrir temas
          </button>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onChange(s.query)}
              className="inline-flex items-center rounded-full border border-border bg-card hover:bg-accent px-3.5 h-9 text-xs font-medium text-foreground/80 hover:text-foreground transition-all duration-300 active:scale-95"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Personalize link — quieter than before, sits below the pills */}
        <Link
          href="/assistants/profile"
          className="group inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Personalize criando um <span className="text-brand">Perfil da Categoria</span>
          </span>
          <ArrowRight
            className="h-3 w-3 group-hover:translate-x-0.5 transition-transform"
            aria-hidden="true"
          />
        </Link>
      </div>
    </div>
  );
}
