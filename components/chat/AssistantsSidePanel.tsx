'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  FileText,
  Handshake,
  LineChart,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

import { ASSISTANTS } from '@/components/assistants/assistants-data';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

type Props = {
  onClose: () => void;
};

/**
 * Ícones são apenas uma representação visual.
 * Os dados reais do assistente vêm de assistants-data.ts.
 *
 * Se um assistente novo não estiver neste mapa,
 * ele recebe automaticamente o ícone Sparkles.
 */
const ASSISTANT_ICONS = {
  abc: BarChart3,
  spend_analysis: LineChart,
  porter: Building2,
  suppliers: Search,
  kraljic: Building2,
  rfp: FileText,
  negotiation: Handshake,
  financial: BarChart3,
  scorecard: BarChart3,
  homologacao: Building2,
  pesquisa_precos: Search,
  indicadores: LineChart,
} as const;

export function AssistantsSidePanel({ onClose }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) return;
      const { data: profile } = await sb
        .from('profiles')
        .select('role')
        .eq('id', u.id)
        .maybeSingle();
      const role = (profile as { role?: string } | null)?.role ?? 'user';
      setIsAdmin(role === 'admin');
    });
  }, []);

  // "Em breve" fica destravado pra admin testar antes do
  // lançamento pro público — mesmo critério do Hub (/assistants).
  const isUnlockedForAdmin = (
    assistant: (typeof ASSISTANTS)[number],
  ) => assistant.badge === 'em_breve' && isAdmin;

  const availableAssistants = ASSISTANTS.filter(
    (assistant) =>
      assistant.showInSidePanel !== false &&
      (!assistant.badge || isUnlockedForAdmin(assistant))
  );

  const upcomingAssistants = ASSISTANTS.filter(
    (assistant) =>
      assistant.showInSidePanel !== false &&
      assistant.badge &&
      !isUnlockedForAdmin(assistant)
  );

  return (
    <aside
      className="
        dark
        w-[21rem]
        shrink-0
        h-full
        bg-card/95
        text-foreground
        border-r
        border-border
        flex
        flex-col
        overflow-hidden
        md:my-2
        md:h-[calc(100vh-1rem)]
        md:rounded-2xl
        md:border
        md:shadow-panel
        dark:md:ring-1
        dark:md:ring-white/10
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-border">
        <h2 className="text-xl font-semibold tracking-tight">
          Assistentes
        </h2>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar assistentes"
          title="Fechar"
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            text-muted-foreground
            hover:bg-accent
            hover:text-foreground
            transition-colors
          "
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Introdução */}
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-foreground">
          Escolha um especialista para começar
        </h3>

        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Selecione um assistente para abrir sua área completa.
        </p>
      </div>

      {/* Conteúdo com scroll */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-2.5">
          {availableAssistants.map((assistant) => {
            const Icon =
              ASSISTANT_ICONS[
                assistant.id as keyof typeof ASSISTANT_ICONS
              ] ?? Sparkles;

            return (
              <Link
                key={assistant.id}
                href={assistant.href}
                onClick={onClose}
                className="
                  group
                  flex
                  items-center
                  gap-3
                  rounded-xl
                  border
                  border-border
                  bg-background/30
                  p-3
                  hover:border-brand/60
                  hover:bg-brand/5
                  transition-all
                "
              >
                {/* Ícone / futuro avatar */}
                <div
                  className="
                    relative
                    flex
                    h-12
                    w-12
                    shrink-0
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-xl
                    border
                    border-brand/20
                    bg-brand-gradient-soft
                  "
                >
                  <Icon className="h-5 w-5 text-brand" />

                  <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-transparent pointer-events-none" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {assistant.title}
                  </div>

                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {assistant.sideSubtitle ?? assistant.short}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Assistentes futuros */}
        {upcomingAssistants.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-3 text-sm font-medium text-foreground">
              Novos assistentes em breve
            </p>

            <div className="space-y-2">
              {upcomingAssistants.map((assistant) => (
                <div
                  key={assistant.id}
                  className="
                    flex
                    items-center
                    gap-3
                    rounded-xl
                    border
                    border-border/70
                    p-3
                    opacity-50
                    cursor-default
                  "
                >
                  <div
                    className="
                      flex
                      h-11
                      w-11
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-dashed
                      border-muted-foreground/40
                    "
                  >
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">
                      {assistant.title}
                    </div>

                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {assistant.badge === 'sob_demanda'
                        ? 'Sob demanda'
                        : 'Em desenvolvimento'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Estamos criando novos especialistas para você.
            </p>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="border-t border-border p-4">
        <Link
          href="/assistants"
          onClick={onClose}
          className="
            flex
            items-center
            justify-between
            rounded-xl
            px-3
            py-2.5
            text-sm
            font-medium
            text-brand
            hover:bg-accent
            transition-colors
          "
        >
          Ver todos os assistentes

          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}