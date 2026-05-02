'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export function Sidebar({ sessions, currentId, onSwitch, onNew, onDelete }: Props) {
  return (
    <aside className="w-72 shrink-0 border-r border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold tracking-tight">ProcurementGPT</span>
        <Button size="sm" variant="ghost" onClick={onNew} aria-label="Nova conversa">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <ul className="p-2 space-y-1">
          {sessions.map((s) => {
            const active = s.id === currentId;
            return (
              <li key={s.id}>
                <div
                  className={`group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer text-sm ${
                    active ? 'bg-primary/10 text-foreground' : 'hover:bg-accent text-foreground'
                  }`}
                  onClick={() => onSwitch(s.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{s.title}</div>
                    <div className="text-xs text-muted-foreground">{formatRelative(s.updatedAt)}</div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Apagar conversa ${s.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
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
