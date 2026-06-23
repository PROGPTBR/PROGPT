'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  Sparkles,
  Pencil,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
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
  /** When provided, each conversation shows a pencil for inline renaming. */
  onRename?: (id: string, title: string) => void;
  /** Collapsed = icon rail. Defaults to expanded. */
  collapsed?: boolean;
  /** When provided, renders the collapse/expand toggle (desktop only). */
  onToggleCollapse?: () => void;
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
  onRename,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  function startEdit(s: StoredSession, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(s.id);
    setDraft(s.title);
  }

  function commitEdit(id: string) {
    if (editingId !== id) return; // guard against double-commit (Enter then blur)
    const clean = draft.trim();
    if (clean) onRename?.(id, clean);
    setEditingId(null);
    setDraft('');
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft('');
  }

  // ---- Collapsed: thin icon rail ----------------------------------------
  if (collapsed) {
    return (
      <aside className="dark w-16 shrink-0 border-r border-border bg-card text-foreground backdrop-blur-md flex flex-col h-full transition-[width] duration-300">
        <div className="flex flex-col items-center gap-1 py-4 border-b border-border">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expandir barra lateral"
            title="Expandir"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNew}
            aria-label="Nova conversa"
            title="Nova conversa"
            className="h-9 w-9 rounded-lg bg-brand-gradient text-black flex items-center justify-center hover:brightness-110 active:scale-95 transition-all brand-glow"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav className="flex flex-col items-center gap-1 py-3">
          <Link
            href="/assistants"
            title="Assistentes"
            aria-label="Assistentes"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-brand hover:bg-brand/10 transition-colors"
          >
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link
            href="/prompts"
            title="Biblioteca de Prompts"
            aria-label="Biblioteca de Prompts"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-brand hover:bg-brand/10 transition-colors"
          >
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </Link>
        </nav>
        <div className="flex-1" />
        <UserRow collapsed />
      </aside>
    );
  }

  // ---- Expanded: full sidebar -------------------------------------------
  return (
    <aside className="dark w-72 shrink-0 border-r border-border bg-card text-foreground backdrop-blur-md flex flex-col h-full transition-[width] duration-300">
      <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-border">
        <Link href="/" className="inline-flex items-center min-w-0 shrink">
          <BrandLogo size="lg" priority />
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onNew}
            aria-label="Nova conversa"
            title="Nova conversa"
            className="inline-flex items-center justify-center rounded-full bg-brand-gradient text-black w-8 h-8 hover:brightness-110 active:scale-95 transition-all brand-glow"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Recolher barra lateral"
              title="Recolher"
              className="inline-flex items-center justify-center rounded-lg w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <Link
        href="/assistants"
        className="group flex items-center gap-2 px-4 py-3 text-sm font-medium border-b border-border text-brand hover:bg-brand/10 transition-colors"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span>Assistentes</span>
        <span className="ml-auto text-xs text-muted-foreground group-hover:text-brand/80 transition-colors">
          →
        </span>
      </Link>
      <Link
        href="/prompts"
        className="group flex items-center gap-2 px-4 py-3 text-sm font-medium border-b border-border text-brand hover:bg-brand/10 transition-colors"
      >
        <BookOpen className="h-4 w-4" aria-hidden="true" />
        <span>Biblioteca de Prompts</span>
        <span className="ml-auto text-xs text-muted-foreground group-hover:text-brand/80 transition-colors">
          →
        </span>
      </Link>
      <ScrollArea className="flex-1">
        <ul className="p-2 space-y-0.5">
          {sessions.map((s) => {
            const active = s.id === currentId;
            const editing = editingId === s.id;
            return (
              <li key={s.id}>
                <div
                  className={`group flex items-center gap-2 px-3 py-2 mt-1 cursor-pointer text-sm rounded-lg border-l-2 transition-colors ${
                    active
                      ? 'bg-brand-gradient-soft border-brand'
                      : 'border-transparent hover:bg-accent'
                  }`}
                  onClick={() => {
                    if (!editing) onSwitch(s.id);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    {editing ? (
                      <input
                        autoFocus
                        value={draft}
                        maxLength={80}
                        aria-label="Novo nome da conversa"
                        onChange={(e) => setDraft(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitEdit(s.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        onBlur={() => commitEdit(s.id)}
                        className="w-full bg-background border border-brand/40 rounded px-1.5 py-0.5 text-sm text-foreground outline-none focus:border-brand"
                      />
                    ) : (
                      <>
                        <div
                          className={`truncate ${active ? 'text-foreground font-medium' : 'text-foreground/90'}`}
                        >
                          {s.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatRelative(s.updatedAt)}
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
                          onClick={(e) => startEdit(s, e)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-brand transition-all"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Apagar conversa ${s.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(s.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
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
