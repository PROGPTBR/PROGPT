'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { FolderOpen, ArrowRight, Sparkles } from 'lucide-react';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { Composer, type ChatAttachment } from './Composer';

// Suggestion pills (Claude/ChatGPT style) — small inline buttons that
// pre-fill the composer when clicked.
type Suggestion = { label: string; query: string };

const SUGGESTIONS: Suggestion[] = [
  { label: 'Definir', query: 'O que é a matriz de Kraljic?' },
  { label: 'Aplicar', query: 'Como aplicar TCO em SaaS?' },
  { label: 'Comparar', query: 'Porter vs Kraljic em compras estratégicas' },
  { label: 'Recomendar', query: 'Estratégia de compras para varejo de alimentos' },
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

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function deriveFirstName(displayName: string | null, email: string | null): string | null {
  if (displayName && displayName.trim().length > 0) {
    const first = displayName.trim().split(/\s+/)[0]!;
    return first;
  }
  if (email && email.includes('@')) {
    const local = email.split('@')[0]!;
    const first = local.split(/[._-]/)[0]!;
    if (first.length === 0) return null;
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  return null;
}

export function EmptyState({
  input,
  onChange,
  onSubmit,
  isLoading,
  onStop,
  profileChip,
}: Props) {
  const [firstName, setFirstName] = useState<string | null>(null);
  const [greeting, setGreeting] = useState<string>(() =>
    greetingFor(new Date().getHours()),
  );

  // Refresh the greeting if the user leaves the tab idle past a time-of-day
  // boundary. Cheap to compute; runs once a minute.
  useEffect(() => {
    const id = setInterval(() => {
      setGreeting(greetingFor(new Date().getHours()));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Wrapped in try because supabaseBrowser() throws when NEXT_PUBLIC_
    // env vars are missing (tests / offline). Greeting just falls back
    // to "Bom dia"/"Boa tarde"/"Boa noite" without a name.
    let sb: ReturnType<typeof supabaseBrowser>;
    try {
      sb = supabaseBrowser();
    } catch {
      return;
    }
    sb.auth
      .getUser()
      .then(async ({ data }) => {
        if (cancelled || !data.user) return;
        const email = data.user.email ?? null;
        const { data: profile } = await sb
          .from('profiles')
          .select('display_name')
          .eq('id', data.user.id)
          .maybeSingle();
        if (cancelled) return;
        const dn =
          (profile as { display_name?: string } | null)?.display_name ?? null;
        setFirstName(deriveFirstName(dn, email));
      })
      .catch(() => {
        // Fail-silent — greeting without name is acceptable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const heading = firstName ? `${greeting}, ${firstName}` : greeting;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8">
        {/* Hero greeting — serif-flavored serif feeling via tracking; Outfit
            handles weight nuance. */}
        <div className="flex items-center gap-3 text-center">
          <Sparkles
            className="h-6 w-6 text-brand flex-shrink-0"
            aria-hidden="true"
          />
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            {heading}
          </h1>
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
            placeholder="Como posso ajudar você hoje?"
          />
        </div>

        {profileChip && (
          <div className="w-full flex justify-center">{profileChip}</div>
        )}

        {/* Suggestion pills (Claude/ChatGPT style) */}
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
