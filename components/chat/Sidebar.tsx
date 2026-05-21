'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { StoredSession } from '@/lib/chat-storage';
import { UserRow } from '@/components/auth/UserRow';

type Props = {
  sessions: StoredSession[];
  currentId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  const day = Math.floor(hr / 24);
  return `${day} d`;
}

export function Sidebar({
  sessions,
  currentId,
  onSwitch,
  onNew,
  onDelete,
}: Props) {
  return (
    <aside className="w-72 shrink-0 border-r border-border bg-card/60 dark:bg-black/40 backdrop-blur-md flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image
            src="/2bsupply-logo.png"
            alt="2B Supply"
            width={241}
            height={57}
            priority
            className="h-6 w-auto dark:brightness-0 dark:invert"
          />
        </Link>
        <button
          type="button"
          onClick={onNew}
          aria-label="Nova conversa"
          title="Nova conversa"
          className="inline-flex items-center justify-center rounded-full bg-brand text-black w-8 h-8 hover:bg-brand/90 active:scale-95 transition-all duration-300"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <Link
        href="/assistants"
        className="group flex items-center gap-2 px-4 py-3 text-sm font-medium border-b border-border text-brand hover:bg-brand/5 transition-colors"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span>Assistentes</span>
        <span className="ml-auto text-xs text-muted-foreground group-hover:text-brand/80 transition-colors">
          →
        </span>
      </Link>
      <ScrollArea className="flex-1">
        <ul className="p-2 space-y-0.5">
          {sessions.map((s) => {
            const active = s.id === currentId;
            return (
              <li key={s.id}>
                <div
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors ${
                    active
                      ? 'bg-brand/10 border border-brand/20'
                      : 'hover:bg-accent border border-transparent'
                  }`}
                  onClick={() => onSwitch(s.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={`truncate ${active ? 'text-foreground' : 'text-foreground/80'}`}
                    >
                      {s.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelative(s.updatedAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Apagar conversa ${s.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
      <UserRow />
    </aside>
  );
}
