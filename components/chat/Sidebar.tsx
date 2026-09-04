'use client';

import { useState } from 'react';
import Link from 'next/link';

import {
  Plus,
  Trash2,
  Sparkles,
  Pencil,
  BookOpen,
  Building2,
  LayoutDashboard,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Phone,
  Search,
  X,
} from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import type { StoredSession } from '@/lib/chat-storage';
import { UserRow } from '@/components/auth/UserRow';
import { BrandLogo } from '@/components/brand/BrandLogo';

type Props = {
  sessions: StoredSession[];
  currentId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;

  /** Quando fornecido, permite renomear conversas. */
  onRename?: (id: string, title: string) => void;

  /** Sidebar recolhida. */
  collapsed?: boolean;

  /** Alterna sidebar aberta/recolhida. */
  onToggleCollapse?: () => void;

  onOpenAssistants?: () => void;
  assistantsOpen?: boolean;

  onOpenPrompts?: () => void;
  promptsOpen?: boolean;
};

const CONTACT_PHONE = '(21) 99979-2912';
const CONTACT_PHONE_HREF = 'tel:+5521999792912';

const NAV_ITEMS = [
  {
    href: '/painel',
    label: 'Painel',
    description: 'Visão geral do ambiente.',
    icon: LayoutDashboard,
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Indicadores, análises e acompanhamento.',
    icon: BarChart3,
  },
  {
    href: '/assistants',
    label: 'Assistentes',
    description: null,
    icon: Sparkles,
  },
  {
    href: '/fornecedores',
    label: 'Fornecedores',
    description: 'Cadastro, avaliação, homologação e histórico.',
    icon: Building2,
  },
  {
    href: '/prompts',
    label: 'Biblioteca de Prompts',
    description: null,
    icon: BookOpen,
  },
] as const;

function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts;

  const min = Math.floor(
    diffMs / 60_000
  );

  if (min < 1) return 'agora';

  if (min < 60) {
    return `${min} min`;
  }

  const hr = Math.floor(
    min / 60
  );

  if (hr < 24) {
    return `${hr} h`;
  }

  const day = Math.floor(
    hr / 24
  );

  return `${day} d`;
}

export function Sidebar({
  sessions,
  currentId,
  onSwitch,
  onNew,
  onDelete,
  onRename,
  collapsed = false,
  onToggleCollapse,
  onOpenAssistants,
  assistantsOpen = false,

  onOpenPrompts,
  promptsOpen = false,
}: Props) {
  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null
  );

  const [draft, setDraft] =
    useState('');

  const [search, setSearch] =
    useState('');

  const filteredSessions =
    search.trim()
      ? sessions.filter((s) =>
          s.title
            .toLowerCase()
            .includes(
              search
                .trim()
                .toLowerCase(),
            ),
        )
      : sessions;

  function startEdit(
    s: StoredSession,
    e: React.MouseEvent
  ) {
    e.stopPropagation();

    setEditingId(s.id);

    setDraft(s.title);
  }

  function commitEdit(
    id: string
  ) {
    if (editingId !== id) {
      return;
    }

    const clean =
      draft.trim();

    if (clean) {
      onRename?.(
        id,
        clean
      );
    }

    setEditingId(null);

    setDraft('');
  }

  function cancelEdit() {
    setEditingId(null);

    setDraft('');
  }

  // ============================================================
  // SIDEBAR RECOLHIDA
  // ============================================================

  if (collapsed) {
    return (
      <aside
        className="
          dark
          flex
          h-full
          w-16
          shrink-0
          flex-col
          border-r
          border-border
          bg-card
          text-foreground
          backdrop-blur-md
          transition-[width]
          duration-300

          md:m-2
          md:h-[calc(100vh-1rem)]
          md:rounded-2xl
          md:border
          md:shadow-panel

          dark:md:ring-1
          dark:md:ring-white/10
        "
      >
        {/* Topo */}
        <div className="flex flex-col items-center gap-1 border-b border-border py-4">
          <button
            type="button"
            onClick={
              onToggleCollapse
            }
            aria-label="Expandir barra lateral"
            title="Expandir"
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              text-muted-foreground
              transition-colors

              hover:bg-accent
              hover:text-foreground
            "
          >
            <PanelLeftOpen
              className="h-5 w-5"
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={onNew}
            aria-label="Nova conversa"
            title="Nova conversa"
            className="
              brand-glow
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              bg-brand-gradient
              text-black
              transition-all

              hover:brightness-110
              active:scale-95
            "
          >
            <Plus
              className="h-5 w-5"
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Navegação */}
<nav className="flex flex-col items-center gap-1 py-3">
  {NAV_ITEMS.map(
    ({
      href,
      label,
      icon: Icon,
    }) => {
      const isAssistants =
        href === '/assistants';

      const isPrompts =
        href === '/prompts';

      if (
        isAssistants ||
        isPrompts
      ) {
        const panelOpen =
          isAssistants
            ? assistantsOpen
            : promptsOpen;

        const onOpenPanel =
          isAssistants
            ? onOpenAssistants
            : onOpenPrompts;

        return (
          <button
            key={href}
            type="button"
            onClick={
              onOpenPanel
            }
            title={label}
            aria-label={label}
            className={`
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              transition-colors
              ${
                panelOpen
                  ? 'bg-brand-gradient-soft text-brand'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }
            `}
          >
            <Icon
              className="h-5 w-5"
              aria-hidden="true"
            />
          </button>
        );
      }

      return (
        <Link
          key={href}
          href={href}
          title={label}
          aria-label={label}
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            text-muted-foreground
            transition-colors
            hover:bg-accent
            hover:text-foreground
          "
        >
          <Icon
            className="h-5 w-5"
            aria-hidden="true"
          />
        </Link>
      );
    }
  )}
</nav>
        {/* Preenche o meio */}
        <div className="flex-1" />

        {/* Contato compacto */}
        <div className="flex justify-center border-t border-border py-2">
          <a
            href={
              CONTACT_PHONE_HREF
            }
            aria-label="Falar com a 2BSUPPLY"
            title={`Fale com a 2BSUPPLY — ${CONTACT_PHONE}`}
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              text-muted-foreground
              transition-colors

              hover:bg-brand/10
              hover:text-brand
            "
          >
            <Phone
              className="h-4 w-4"
              aria-hidden="true"
            />
          </a>
        </div>

        <UserRow collapsed />
      </aside>
    );
  }

  // ============================================================
  // SIDEBAR ABERTA
  // ============================================================

  return (
    <aside
      className="
        dark
        flex
        h-full
        w-72
        shrink-0
        flex-col
        overflow-hidden
        border-r
        border-border
        bg-card
        text-foreground
        backdrop-blur-md
        transition-[width]
        duration-300

        md:m-2
        md:h-[calc(100vh-1rem)]
        md:rounded-2xl
        md:border
        md:shadow-panel

        dark:md:ring-1
        dark:md:ring-white/10
      "
    >
      {/* ========================================================
          TOPO
      ========================================================= */}

      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-4">
        <Link
          href="/"
          className="inline-flex min-w-0 shrink"
        >
          <BrandLogo
            size="lg"
            priority
          />
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            aria-label="Nova conversa"
            title="Nova conversa"
            className="
              brand-glow
              inline-flex
              h-8
              w-8
              items-center
              justify-center
              rounded-full
              bg-brand-gradient
              text-black
              transition-all

              hover:brightness-110
              active:scale-95
            "
          >
            <Plus
              className="h-4 w-4"
              aria-hidden="true"
            />
          </button>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={
                onToggleCollapse
              }
              aria-label="Recolher barra lateral"
              title="Recolher"
              className="
                inline-flex
                h-8
                w-8
                items-center
                justify-center
                rounded-lg
                text-muted-foreground
                transition-colors

                hover:bg-accent
                hover:text-foreground
              "
            >
              <PanelLeftClose
                className="h-4 w-4"
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          NAVEGAÇÃO
      ========================================================= */}

      <nav className="space-y-0.5 border-b border-border p-2">
{NAV_ITEMS.map(
  ({
    href,
    label,
    description,
    icon: Icon,
  }) => {
    const isAssistants =
      href === '/assistants';

    const isPrompts =
      href === '/prompts';

    const isSidePanelItem =
      isAssistants || isPrompts;

    const panelOpen =
      isAssistants
        ? assistantsOpen
        : promptsOpen;

    const onOpenPanel =
      isAssistants
        ? onOpenAssistants
        : onOpenPrompts;

    if (isSidePanelItem) {
      return (
        <button
          key={href}
          type="button"
          onClick={onOpenPanel}
          className={`
            group
            flex
            w-full
            items-center
            rounded-xl
            px-3
            py-2.5
            text-sm
            font-medium
            transition-colors
            ${
              panelOpen
                ? 'bg-brand-gradient-soft text-brand'
                : 'text-foreground/80 hover:bg-accent hover:text-foreground'
            }
          `}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Icon
              className={`
                h-4
                w-4
                shrink-0
                transition-colors
                ${
                  panelOpen
                    ? 'text-brand'
                    : 'text-muted-foreground group-hover:text-foreground'
                }
              `}
              aria-hidden="true"
            />

            <span className="truncate">
              {label}
            </span>
          </div>

          <ChevronRight
            className={`
              h-4
              w-4
              shrink-0
              transition-all
              ${
                panelOpen
                  ? 'text-brand'
                  : 'text-muted-foreground group-hover:text-foreground'
              }
            `}
            aria-hidden="true"
          />
        </button>
      );
    }

    return (
      <Link
        key={href}
        href={href}
        className="
          group
          flex
          items-start
          gap-3
          rounded-xl
          px-3
          py-2.5
          text-foreground/80
          transition-colors

          hover:bg-accent
          hover:text-foreground
        "
      >
        <Icon
          className="
            mt-0.5
            h-4
            w-4
            shrink-0
            text-muted-foreground
            transition-colors

            group-hover:text-foreground
          "
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {label}
          </div>

          {description && (
            <div className="mt-0.5 text-[11px] font-normal leading-4 text-[#8fb3d9]">
              {description}
            </div>
          )}
        </div>
      </Link>
    );
  }
)}
      </nav>

  {/* ========================================================
    CONVERSAS
========================================================= */}

<div className="p-2">
  {/* Título da seção */}
{/* Título da seção + Nova conversa */}
<div className="mb-2 flex items-center justify-between px-1">
  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
    Conversas
  </div>

  <button
    type="button"
    onClick={onNew}
    aria-label="Nova conversa"
    title="Nova conversa"
    className="
      brand-glow
      inline-flex
      h-8
      w-8
      shrink-0
      items-center
      justify-center
      rounded-full
      bg-brand-gradient
      text-black
      transition-all

      hover:brightness-110
      active:scale-95
    "
  >
    <Plus
      className="h-4 w-4"
      aria-hidden="true"
    />
  </button>
</div>

{/* Histórico */}
<div className="border-b border-border px-1 pb-2 text-[11px] font-medium text-muted-foreground">
  Histórico de conversas
</div>

  {/* Busca */}
  <div className="relative mt-3">
    <Search
      className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />

    <input
      type="text"
      value={search}
      onChange={(e) =>
        setSearch(e.target.value)
      }
      placeholder="Buscar conversas"
      aria-label="Buscar conversas"
      className="
        w-full
        rounded-lg
        border
        border-border
        bg-background
        py-1.5
        pl-8
        pr-7
        text-xs
        text-foreground
        placeholder-muted-foreground
        outline-none
        transition-colors

        focus:border-brand
      "
    />

    {search && (
      <button
        type="button"
        onClick={() => setSearch('')}
        aria-label="Limpar busca"
        className="
          absolute
          right-2
          top-1/2
          -translate-y-1/2
          text-muted-foreground
          transition-colors

          hover:text-foreground
        "
      >
        <X
          className="h-3.5 w-3.5"
          aria-hidden="true"
        />
      </button>
    )}
  </div>
</div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="space-y-0.5 p-2">
          {filteredSessions.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhuma conversa encontrada
            </li>
          )}

          {filteredSessions.map(
            (s) => {
              const active =
                s.id ===
                currentId;

              const editing =
                editingId ===
                s.id;

              return (
                <li key={s.id}>
                  <div
                    className={`
                      group
                      mt-1
                      flex
                      cursor-pointer
                      items-center
                      gap-2
                      rounded-lg
                      border-l-2
                      px-3
                      py-2
                      text-sm
                      transition-colors
                      ${
                        active
                          ? 'border-brand bg-brand-gradient-soft'
                          : 'border-transparent hover:bg-accent'
                      }
                    `}
                    onClick={() => {
                      if (
                        !editing
                      ) {
                        onSwitch(
                          s.id
                        );
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <input
                          autoFocus
                          value={
                            draft
                          }
                          maxLength={
                            80
                          }
                          aria-label="Novo nome da conversa"
                          onChange={(
                            e
                          ) =>
                            setDraft(
                              e
                                .target
                                .value
                            )
                          }
                          onClick={(
                            e
                          ) =>
                            e.stopPropagation()
                          }
                          onKeyDown={(
                            e
                          ) => {
                            if (
                              e.key ===
                              'Enter'
                            ) {
                              e.preventDefault();

                              commitEdit(
                                s.id
                              );
                            } else if (
                              e.key ===
                              'Escape'
                            ) {
                              e.preventDefault();

                              cancelEdit();
                            }
                          }}
                          onBlur={() =>
                            commitEdit(
                              s.id
                            )
                          }
                          className="
                            w-full
                            rounded
                            border
                            border-brand/40
                            bg-background
                            px-1.5
                            py-0.5
                            text-sm
                            text-foreground
                            outline-none

                            focus:border-brand
                          "
                        />
                      ) : (
                        <>
                          <div
                            className={`
                              truncate
                              ${
                                active
                                  ? 'font-medium text-foreground'
                                  : 'text-foreground/90'
                              }
                            `}
                          >
                            {
                              s.title
                            }
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {formatRelative(
                              s.updatedAt
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {!editing && (
                      <div className="flex items-center gap-1">
                        {onRename && (
                          <button
                            type="button"
                            aria-label={`Renomear conversa ${s.title}`}
                            title="Renomear"
                            onClick={(
                              e
                            ) =>
                              startEdit(
                                s,
                                e
                              )
                            }
                            className="
                              opacity-0
                              text-muted-foreground
                              transition-all

                              group-hover:opacity-100
                              hover:text-brand
                            "
                          >
                            <Pencil
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </button>
                        )}

                        <button
                          type="button"
                          aria-label={`Apagar conversa ${s.title}`}
                          onClick={(
                            e
                          ) => {
                            e.stopPropagation();

                            onDelete(
                              s.id
                            );
                          }}
                          className="
                            opacity-0
                            text-muted-foreground
                            transition-all

                            group-hover:opacity-100
                            hover:text-red-400
                          "
                        >
                          <Trash2
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            }
          )}
        </ul>
      </ScrollArea>

      {/* ========================================================
          CTA 2BSUPPLY
          Fica preso próximo ao rodapé porque o ScrollArea acima
          ocupa todo o espaço restante com flex-1.
      ========================================================= */}

      <div className="shrink-0 px-3 pb-3">
        <a
          href={
            CONTACT_PHONE_HREF
          }
          className="
            group
            block
            rounded-xl
            bg-brand/5
            px-3
            py-3
            transition-all
            duration-200

            hover:bg-brand/10
          "
        >
          <div className="text-[11px] leading-4 text-muted-foreground">
            Suporte
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg
  viewBox="0 0 24 24"
  className="h-3.5 w-3.5"
  fill="currentColor"
  aria-hidden="true"
>
  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.198.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.371-.272.298-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.625.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.029 6.988 2.895a9.825 9.825 0 012.893 6.99c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.055 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.557 0 11.892-5.335 11.895-11.893a11.821 11.821 0 00-3.481-8.413z" />
</svg>

            {CONTACT_PHONE}
          </div>
        </a>
      </div>

      {/* ========================================================
          USUÁRIO
      ========================================================= */}

      <UserRow />
    </aside>
  );
}