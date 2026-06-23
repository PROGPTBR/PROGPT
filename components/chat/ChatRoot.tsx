'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatSessionsRemote as useChatSessions } from '@/hooks/useChatSessionsRemote';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatSession } from './ChatSession';
import { ChatErrorBoundary } from './ChatErrorBoundary';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { CHAT_PREFILL_KEY } from '@/lib/prompts/chat-prefill';

export function ChatRoot() {
  // Wait for client mount before reading localStorage. The server and the
  // initial client render both produce the empty placeholder, so React
  // hydration matches; the real tree mounts in a subsequent effect.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-screen bg-background" />;
  }

  return <ChatRootMounted />;
}

const SIDEBAR_COLLAPSED_KEY = 'progpt_sidebar_collapsed';

function ChatRootMounted() {
  const sessionsApi = useChatSessions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore the persisted collapse preference after mount.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Sub-projeto 32 — "Usar no chat" da Biblioteca de Prompts. Capturamos o
  // texto do sessionStorage UMA vez aqui no pai (antes de qualquer ChatSession
  // montar e ler), e limpamos. Assim conseguimos decidir abrir uma conversa
  // NOVA antes de prefixar.
  const [pendingPrefill, setPendingPrefill] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const v = window.sessionStorage.getItem(CHAT_PREFILL_KEY);
      if (v) window.sessionStorage.removeItem(CHAT_PREFILL_KEY);
      return v;
    } catch {
      return null;
    }
  });
  const decidedRef = useRef(false);

  // Prompt vindo da biblioteca deve SEMPRE cair numa conversa nova/vazia: se a
  // atual já tem histórico, abre uma nova; se já está vazia, reaproveita.
  useEffect(() => {
    if (decidedRef.current) return;
    if (!pendingPrefill) return;
    if (!sessionsApi.currentId) return; // espera hidratar
    decidedRef.current = true;
    const cur = sessionsApi.current;
    if (cur && cur.messages.length > 0) {
      void sessionsApi.createNew();
    }
  }, [pendingPrefill, sessionsApi.currentId, sessionsApi.current, sessionsApi.createNew]);

  if (!sessionsApi.currentId) {
    return <div className="h-screen bg-background" />;
  }

  // Só prefila a sessão-alvo (a nova/vazia). A conversa antiga (com mensagens)
  // nunca recebe o prefill.
  const prefillForSession =
    pendingPrefill && sessionsApi.current.messages.length === 0
      ? pendingPrefill
      : null;

  return (
    <div className="flex h-screen bg-background text-foreground font-outfit antialiased">
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
        />
      </div>
      <Sheet open={drawerOpen} onOpenChange={(open) => setDrawerOpen(open)}>
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
          />
        </SheetContent>
      </Sheet>
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenSidebar={() => setDrawerOpen(true)} />
        <ChatErrorBoundary>
          <ChatSession
            key={sessionsApi.currentId}
            session={sessionsApi.current}
            initialRatings={sessionsApi.ratings}
            prefill={prefillForSession}
            onPrefillConsumed={() => setPendingPrefill(null)}
            onMessagesChange={sessionsApi.updateMessages}
            onTitleChange={
              sessionsApi.setTitleLocal
                ? (title) =>
                    sessionsApi.setTitleLocal!(sessionsApi.currentId, title)
                : undefined
            }
          />
        </ChatErrorBoundary>
      </div>
    </div>
  );
}
