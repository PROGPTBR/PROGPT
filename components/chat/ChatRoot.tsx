'use client';

import { useEffect, useState } from 'react';
import { useChatSessionsRemote as useChatSessions } from '@/hooks/useChatSessionsRemote';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatSession } from './ChatSession';
import { ChatErrorBoundary } from './ChatErrorBoundary';
import { Sheet, SheetContent } from '@/components/ui/sheet';

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

  if (!sessionsApi.currentId) {
    return <div className="h-screen bg-background dark:bg-[#0d0d0d]" />;
  }

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
            onMessagesChange={sessionsApi.updateMessages}
            onTitleChange={
              sessionsApi.setTitleLocal
                ? (title) =>
                    sessionsApi.setTitleLocal!(sessionsApi.currentId, title)
                : undefined
            }
            onActivePerfilChange={sessionsApi.setActivePerfil}
          />
        </ChatErrorBoundary>
      </div>
    </div>
  );
}
