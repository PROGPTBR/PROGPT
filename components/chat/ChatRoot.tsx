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
    return <div className="h-screen bg-background dark:bg-[#0d0d0d]" />;
  }

  return <ChatRootMounted />;
}

function ChatRootMounted() {
  const sessionsApi = useChatSessions();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    return <div className="h-screen bg-background dark:bg-[#0d0d0d]" />;
  }

  // Só prefila a sessão-alvo (a nova/vazia). A conversa antiga (com mensagens)
  // nunca recebe o prefill.
  const prefillForSession =
    pendingPrefill && sessionsApi.current.messages.length === 0
      ? pendingPrefill
      : null;

  return (
    <div className="flex h-screen bg-background dark:bg-[#0d0d0d] text-foreground dark:text-white font-outfit antialiased">
      <div className="hidden md:flex">
        <Sidebar
          sessions={sessionsApi.sessions}
          currentId={sessionsApi.currentId}
          onSwitch={sessionsApi.switchTo}
          onNew={sessionsApi.createNew}
          onDelete={sessionsApi.deleteSession}
          onRename={sessionsApi.renameSession}
        />
      </div>
      <Sheet open={drawerOpen} onOpenChange={(open) => setDrawerOpen(open)}>
        <SheetContent
          side="left"
          className="p-0 w-72 bg-background dark:bg-[#0d0d0d] border-border dark:border-white/5"
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
