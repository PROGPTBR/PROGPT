'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

import { useChatSessionsRemote as useChatSessions } from '@/hooks/useChatSessionsRemote';

import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatSession } from './ChatSession';
import { ChatErrorBoundary } from './ChatErrorBoundary';
import { AssistantsSidePanel } from './AssistantsSidePanel';
import { PromptsSidePanel } from './PromptsSidePanel';

import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';

import { CHAT_PREFILL_KEY } from '@/lib/prompts/chat-prefill';

const SIDEBAR_COLLAPSED_KEY =
  'progpt_sidebar_collapsed';

/* ============================================================
   CHAT ROOT
============================================================ */

export function ChatRoot() {
  const [mounted, setMounted] =
    useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen bg-background" />
    );
  }

  return <ChatRootMounted />;
}

/* ============================================================
   CHAT ROOT MONTADO
============================================================ */

function ChatRootMounted() {
  const sessionsApi =
    useChatSessions();

  /* ==========================================================
     WELCOME EMAIL (fallback) — ver lib/email/welcome.ts. Idempotente
     no servidor, então disparar 1x por mount do /chat é seguro/barato.
  ========================================================== */

  useEffect(() => {
    fetch('/api/account/welcome-email', { method: 'POST' }).catch(() => {
      /* fail-soft — não é crítico pro chat funcionar */
    });
  }, []);

  /* ==========================================================
     SIDEBAR
  ========================================================== */

  const [
    drawerOpen,
    setDrawerOpen,
  ] = useState(false);

  const [
    collapsed,
    setCollapsed,
  ] = useState(false);

  /* ==========================================================
     ASSISTENTES
  ========================================================== */

  const [
    assistantsOpen,
    setAssistantsOpen,
  ] = useState(false);

  const [
    assistantsMobileOpen,
    setAssistantsMobileOpen,
  ] = useState(false);

  /* ==========================================================
     BIBLIOTECA DE PROMPTS
  ========================================================== */

  const [
    promptsOpen,
    setPromptsOpen,
  ] = useState(false);

  const [
    promptsMobileOpen,
    setPromptsMobileOpen,
  ] = useState(false);

  /* ==========================================================
     TEMA
  ========================================================== */

  const {
    resolvedTheme,
    setTheme,
  } = useTheme();

  const isDark =
    resolvedTheme === 'dark';

  /* ==========================================================
     RESTAURA ESTADO DA SIDEBAR
  ========================================================== */

  useEffect(() => {
    try {
      setCollapsed(
        window.localStorage.getItem(
          SIDEBAR_COLLAPSED_KEY
        ) === '1'
      );
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapse() {
    setCollapsed(
      (current) => {
        const next =
          !current;

        try {
          window.localStorage.setItem(
            SIDEBAR_COLLAPSED_KEY,
            next ? '1' : '0'
          );
        } catch {
          /* ignore */
        }

        return next;
      }
    );
  }

  /* ==========================================================
     PREFILL DA BIBLIOTECA DE PROMPTS

     Também continua suportando o fluxo existente da página
     /prompts através do sessionStorage.
  ========================================================== */

  const [
    pendingPrefill,
    setPendingPrefill,
  ] = useState<string | null>(
    () => {
      if (
        typeof window ===
        'undefined'
      ) {
        return null;
      }

      try {
        const value =
          window.sessionStorage.getItem(
            CHAT_PREFILL_KEY
          );

        if (value) {
          window.sessionStorage.removeItem(
            CHAT_PREFILL_KEY
          );
        }

        return value;
      } catch {
        return null;
      }
    }
  );

  /*
   * Controla se já decidimos se o prompt
   * precisa abrir uma conversa nova.
   */
  const decidedRef =
    useRef(false);

  const {
    current,
    currentId,
    createNew,
  } = sessionsApi;

  /* ==========================================================
     PROMPT → CONVERSA NOVA OU ATUAL

     Se a conversa atual já tiver mensagens:
     cria uma conversa nova.

     Se estiver vazia:
     reutiliza a conversa atual.
  ========================================================== */

  useEffect(() => {
    if (
      decidedRef.current
    ) {
      return;
    }

    if (!pendingPrefill) {
      return;
    }

    if (!currentId) {
      return;
    }

    decidedRef.current =
      true;

    if (
      current &&
      current.messages.length > 0
    ) {
      void createNew();
    }
  }, [
    pendingPrefill,
    currentId,
    current,
    createNew,
  ]);

  /* ==========================================================
     SELEÇÃO DE PROMPT PELO PAINEL LATERAL

     Fluxo:
     1. usuário clica no prompt
     2. painel fecha
     3. se necessário cria conversa nova
     4. prompt aparece no Composer
  ========================================================== */

  function handleSelectPrompt(
    prompt: string
  ) {
    const clean =
      prompt.trim();

    if (!clean) {
      return;
    }

    /*
     * Permite executar novamente a decisão
     * conversa atual / conversa nova.
     */
    decidedRef.current =
      false;

    setPendingPrefill(
      clean
    );

    /*
     * Fecha todos os painéis desktop.
     */
    setPromptsOpen(false);
    setAssistantsOpen(false);

    /*
     * Fecha todos os painéis mobile.
     */
    setPromptsMobileOpen(false);
    setAssistantsMobileOpen(false);

    setDrawerOpen(false);
  }

  /* ==========================================================
     SEM SESSÃO
  ========================================================== */

  if (!currentId) {
    return (
      <div className="h-screen bg-background" />
    );
  }

  /* ==========================================================
     PREFILL SOMENTE EM CONVERSA VAZIA
  ========================================================== */

  const prefillForSession =
    pendingPrefill &&
    sessionsApi.current.messages
      .length === 0
      ? pendingPrefill
      : null;

  return (
    <div
      className="
        flex
        h-screen
        bg-background
        font-outfit
        text-foreground
        antialiased
      "
    >
      {/* ======================================================
          SIDEBAR DESKTOP
      ======================================================= */}

      <div className="hidden md:flex">
        <Sidebar
          sessions={
            sessionsApi.sessions
          }
          currentId={
            sessionsApi.currentId
          }
          onSwitch={
            sessionsApi.switchTo
          }
          onNew={
            sessionsApi.createNew
          }
          onDelete={
            sessionsApi.deleteSession
          }
          onRename={
            sessionsApi.renameSession
          }
          collapsed={
            collapsed
          }
          onToggleCollapse={
            toggleCollapse
          }

          /* ================================================
             ASSISTENTES
          ================================================= */

          assistantsOpen={
            assistantsOpen
          }

          onOpenAssistants={() => {
            /*
             * Fecha Prompts antes
             * de abrir Assistentes.
             */
            setPromptsOpen(false);

            setAssistantsOpen(
              (open) => !open
            );
          }}

          /* ================================================
             PROMPTS
          ================================================= */

          promptsOpen={
            promptsOpen
          }

          onOpenPrompts={() => {
            /*
             * Fecha Assistentes antes
             * de abrir Prompts.
             */
            setAssistantsOpen(false);

            setPromptsOpen(
              (open) => !open
            );
          }}
        />
      </div>

      {/* ======================================================
          PAINEL ASSISTENTES — DESKTOP
      ======================================================= */}

      {assistantsOpen && (
        <div className="hidden md:flex">
          <AssistantsSidePanel
            onClose={() =>
              setAssistantsOpen(
                false
              )
            }
          />
        </div>
      )}

      {/* ======================================================
          PAINEL PROMPTS — DESKTOP
      ======================================================= */}

      {promptsOpen && (
        <div className="hidden md:flex">
          <PromptsSidePanel
            onClose={() =>
              setPromptsOpen(
                false
              )
            }
            onSelectPrompt={
              handleSelectPrompt
            }
          />
        </div>
      )}

      {/* ======================================================
          SIDEBAR MOBILE
      ======================================================= */}

      <Sheet
        open={drawerOpen}
        onOpenChange={
          setDrawerOpen
        }
      >
        <SheetContent
          side="left"
          showCloseButton={
            false
          }
          className="
            w-[17rem]
            max-w-[85vw]
            border-border
            bg-[#0a0f1a]
            p-0
          "
        >
          <Sidebar
            sessions={
              sessionsApi.sessions
            }
            currentId={
              sessionsApi.currentId
            }

            /* Trocar conversa */
            onSwitch={(id) => {
              sessionsApi.switchTo(
                id
              );

              setDrawerOpen(
                false
              );
            }}

            /* Nova conversa */
            onNew={() => {
              sessionsApi.createNew();

              setDrawerOpen(
                false
              );
            }}

            onDelete={
              sessionsApi.deleteSession
            }

            onRename={
              sessionsApi.renameSession
            }

            /* ==============================================
               ASSISTENTES MOBILE
            =============================================== */

            assistantsOpen={
              assistantsMobileOpen
            }

            onOpenAssistants={() => {
              /*
               * Fecha menu principal.
               */
              setDrawerOpen(
                false
              );

              /*
               * Garante que prompts fique fechado.
               */
              setPromptsMobileOpen(
                false
              );

              /*
               * Abre Assistentes.
               */
              setAssistantsMobileOpen(
                true
              );
            }}

            /* ==============================================
               PROMPTS MOBILE
            =============================================== */

            promptsOpen={
              promptsMobileOpen
            }

            onOpenPrompts={() => {
              /*
               * Fecha menu principal.
               */
              setDrawerOpen(
                false
              );

              /*
               * Garante que Assistentes fique fechado.
               */
              setAssistantsMobileOpen(
                false
              );

              /*
               * Abre Biblioteca.
               */
              setPromptsMobileOpen(
                true
              );
            }}
          />
        </SheetContent>
      </Sheet>

      {/* ======================================================
          ASSISTENTES MOBILE
      ======================================================= */}

      <Sheet
        open={
          assistantsMobileOpen
        }
        onOpenChange={
          setAssistantsMobileOpen
        }
      >
        <SheetContent
          side="left"
          showCloseButton={
            false
          }
          className="
            w-[21rem]
            max-w-[92vw]
            border-border
            bg-[#0a0f1a]
            p-0
            md:hidden
          "
        >
          <AssistantsSidePanel
            onClose={() =>
              setAssistantsMobileOpen(
                false
              )
            }
          />
        </SheetContent>
      </Sheet>

      {/* ======================================================
          PROMPTS MOBILE
      ======================================================= */}

      <Sheet
        open={
          promptsMobileOpen
        }
        onOpenChange={
          setPromptsMobileOpen
        }
      >
        <SheetContent
          side="left"
          showCloseButton={
            false
          }
          className="
            w-[22rem]
            max-w-[92vw]
            border-border
            bg-[#0a0f1a]
            p-0
            md:hidden
          "
        >
          <PromptsSidePanel
            onClose={() =>
              setPromptsMobileOpen(
                false
              )
            }
            onSelectPrompt={
              handleSelectPrompt
            }
          />
        </SheetContent>
      </Sheet>

      {/* ======================================================
          ÁREA PRINCIPAL DO CHAT
      ======================================================= */}

      <div
        className="
          relative
          flex
          min-w-0
          flex-1
          flex-col
          bg-background
          transition-colors
          duration-300
        "
      >
        <Header
          onOpenSidebar={() =>
            setDrawerOpen(
              true
            )
          }
        />

        {/* ====================================================
            TEMA CLARO / ESCURO
        ===================================================== */}

        <button
          type="button"
          onClick={() =>
            setTheme(
              isDark
                ? 'light'
                : 'dark'
            )
          }
          aria-label={
            isDark
              ? 'Mudar para tema claro'
              : 'Mudar para tema escuro'
          }
          title={
            isDark
              ? 'Tema claro'
              : 'Tema escuro'
          }
          className="
            absolute
            right-5
            top-4
            z-50

            inline-flex
            h-10
            w-10

            items-center
            justify-center

            rounded-full

            border
            border-border

            bg-background/80

            text-muted-foreground

            shadow-sm

            backdrop-blur-md

            transition-all
            duration-200

            hover:bg-muted
            hover:text-foreground
          "
        >
          {isDark ? (
            <Sun
              className="
                h-[18px]
                w-[18px]
              "
              aria-hidden="true"
            />
          ) : (
            <Moon
              className="
                h-[18px]
                w-[18px]
              "
              aria-hidden="true"
            />
          )}
        </button>

        {/* ====================================================
            CHAT
        ===================================================== */}

        <ChatErrorBoundary>
          <ChatSession
            key={
              sessionsApi.currentId
            }

            session={
              sessionsApi.current
            }

            initialRatings={
              sessionsApi.ratings
            }

            /* Prompt selecionado */
            prefill={
              prefillForSession
            }

            /*
             * ChatSession avisa quando já colocou
             * o prompt dentro do Composer.
             */
            onPrefillConsumed={() =>
              setPendingPrefill(
                null
              )
            }

            onMessagesChange={
              sessionsApi.updateMessages
            }

            onTitleChange={
              sessionsApi.setTitleLocal
                ? (title) =>
                    sessionsApi.setTitleLocal!(
                      sessionsApi.currentId,
                      title
                    )
                : undefined
            }
          />
        </ChatErrorBoundary>
      </div>
    </div>
  );
}