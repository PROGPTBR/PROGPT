'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

import { useChatSessionsRemote as useChatSessions } from '@/hooks/useChatSessionsRemote';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatSession } from './ChatSession';
import { ChatErrorBoundary } from './ChatErrorBoundary';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { CHAT_PREFILL_KEY } from '@/lib/prompts/chat-prefill';
import { AssistantsSidePanel } from './AssistantsSidePanel';

export function ChatRoot() {
  // Wait for client mount before reading localStorage. The server and the
  // initial client render both produce the empty placeholder, so React
  // hydration matches; the real tree mounts in a subsequent effect.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-screen bg-background" />;
  }

  return <ChatRootMounted />;
}

const SIDEBAR_COLLAPSED_KEY = 'progpt_sidebar_collapsed';

function ChatRootMounted() {
  const sessionsApi = useChatSessions();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assistantsOpen, setAssistantsOpen] = useState(false);
  const [assistantsMobileOpen, setAssistantsMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Tema claro / escuro
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Restore the persisted collapse preference after mount.
  useEffect(() => {
    try {
      setCollapsed(
        window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
      );
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;

      try {
        window.localStorage.setItem(
          SIDEBAR_COLLAPSED_KEY,
          next ? '1' : '0'
        );
      } catch {
        /* ignore */
      }

      return next;
    });
  }

  // Sub-projeto 32 — "Usar no chat" da Biblioteca de Prompts.
  // Capturamos o texto do sessionStorage UMA vez aqui no pai
  // e limpamos.
  const [pendingPrefill, setPendingPrefill] = useState<string | null>(
    () => {
      if (typeof window === 'undefined') return null;

      try {
        const v = window.sessionStorage.getItem(CHAT_PREFILL_KEY);

        if (v) {
          window.sessionStorage.removeItem(CHAT_PREFILL_KEY);
        }

        return v;
      } catch {
        return null;
      }
    }
  );

  const decidedRef = useRef(false);

  const {
    current,
    currentId,
    createNew,
  } = sessionsApi;

  // Prompt vindo da biblioteca deve SEMPRE cair numa conversa nova/vazia.
  // Se a atual já tem histórico, abre uma nova.
  // Se já está vazia, reaproveita.
  useEffect(() => {
    if (decidedRef.current) return;
    if (!pendingPrefill) return;
    if (!currentId) return;

    decidedRef.current = true;

    if (current && current.messages.length > 0) {
      void createNew();
    }
  }, [
    pendingPrefill,
    currentId,
    current,
    createNew,
  ]);

  if (!currentId) {
    return <div className="h-screen bg-background" />;
  }

  // Só prefila a sessão-alvo (a nova/vazia).
  // A conversa antiga (com mensagens) nunca recebe o prefill.
  const prefillForSession =
    pendingPrefill &&
    sessionsApi.current.messages.length === 0
      ? pendingPrefill
      : null;

  return (
    <div className="flex h-screen bg-background text-foreground font-outfit antialiased">
      {/* Sidebar desktop */}
      <div className="hidden md:flex">
        <Sidebar
          sessions={sessionsApi.sessions}
          currentId={sessionsApi.currentId}
          onSwitch={sessionsApi.switchTo}
          onNew={sessionsApi.createNew}
          onDelete={sessionsApi.deleteSession}
          onRename={sessionsApi.renameSession}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          assistantsOpen={assistantsOpen}
          onOpenAssistants={() =>
            setAssistantsOpen((open) => !open)
          }
        />
      </div>

      {/* Painel lateral de assistentes — desktop */}
      {assistantsOpen && (
        <div className="hidden md:flex">
          <AssistantsSidePanel
            onClose={() => setAssistantsOpen(false)}
          />
        </div>
      )}

      {/* Sidebar mobile */}
      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => setDrawerOpen(open)}
      >
        <SheetContent
          side="left"
          showCloseButton={false}
          className="p-0 w-[17rem] max-w-[85vw] bg-[#0a0f1a] border-border"
        >
          <Sidebar
            sessions={sessionsApi.sessions}
            currentId={sessionsApi.currentId}
            onSwitch={(id) => {
              sessionsApi.switchTo(id);
              setDrawerOpen(false);
            }}
            onNew={() => {
              sessionsApi.createNew();
              setDrawerOpen(false);
            }}
            onDelete={sessionsApi.deleteSession}
            onRename={sessionsApi.renameSession}
            assistantsOpen={assistantsMobileOpen}
            onOpenAssistants={() => {
              setDrawerOpen(false);
              setAssistantsMobileOpen(true);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Painel assistentes mobile */}
      <Sheet
        open={assistantsMobileOpen}
        onOpenChange={setAssistantsMobileOpen}
      >
        <SheetContent
          side="left"
          showCloseButton={false}
          className="md:hidden p-0 w-[21rem] max-w-[92vw] bg-[#0a0f1a] border-border"
        >
          <AssistantsSidePanel
            onClose={() =>
              setAssistantsMobileOpen(false)
            }
          />
        </SheetContent>
      </Sheet>

      {/* Chat continua visível */}
      <div className="relative flex-1 flex flex-col min-w-0 bg-background transition-colors duration-300">
        <Header
          onOpenSidebar={() => setDrawerOpen(true)}
        />

        {/* Botão tema claro / escuro */}
        <button
          type="button"
          onClick={() =>
            setTheme(isDark ? 'light' : 'dark')
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
            top-4
            right-5
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
              className="h-[18px] w-[18px]"
              aria-hidden="true"
            />
          ) : (
            <Moon
              className="h-[18px] w-[18px]"
              aria-hidden="true"
            />
          )}
        </button>

        <ChatErrorBoundary>
          <ChatSession
            key={sessionsApi.currentId}
            session={sessionsApi.current}
            initialRatings={sessionsApi.ratings}
            prefill={prefillForSession}
            onPrefillConsumed={() =>
              setPendingPrefill(null)
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