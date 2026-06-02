'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '@/lib/rag/types';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { deriveTitle, type StoredSession } from '@/lib/chat-storage';
import type { UseChatSessions } from '@/hooks/useChatSessions';

type DBRow = {
  id: string;
  title: string;
  messages: ChatMessage[] | null;
  updated_at: string;
  active_perfil_id?: string | null;
};

function rowToSession(r: DBRow): StoredSession {
  return {
    id: r.id,
    title: r.title,
    messages: (r.messages as ChatMessage[]) ?? [],
    updatedAt: new Date(r.updated_at).getTime(),
    activePerfilId: r.active_perfil_id ?? null,
  };
}

const EMPTY_STUB: StoredSession = { id: '', title: '', messages: [], updatedAt: 0 };

export function useChatSessionsRemote(): UseChatSessions {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [hydrated, setHydrated] = useState(false);
  const [ratings, setRatings] = useState<Map<string, 'up' | 'down'>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from('sessions')
        .select('id, title, messages, updated_at, active_perfil_id')
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn('[useChatSessionsRemote] load failed:', error);
        setHydrated(true);
        return;
      }
      const rows = (data ?? []) as DBRow[];
      if (rows.length === 0) {
        const { data: created, error: insErr } = await sb
          .from('sessions')
          .insert({})
          .select('id, title, messages, updated_at, active_perfil_id')
          .single();
        if (cancelled) return;
        if (insErr || !created) {
          console.warn('[useChatSessionsRemote] auto-create failed:', insErr);
          setHydrated(true);
          return;
        }
        const fresh = rowToSession(created as DBRow);
        setSessions([fresh]);
        setCurrentId(fresh.id);
      } else {
        const list = rows.map(rowToSession);
        setSessions(list);
        setCurrentId(list[0]!.id);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from('message_feedback')
        .select('trace_id, rating')
        .eq('session_id', currentId);
      if (cancelled) return;
      if (error) {
        console.warn('[useChatSessionsRemote] feedback load failed:', error);
        return;
      }
      const next = new Map<string, 'up' | 'down'>();
      for (const r of (data ?? []) as Array<{ trace_id: string; rating: 'up' | 'down' }>) {
        next.set(r.trace_id, r.rating);
      }
      setRatings(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  const switchTo = useCallback((id: string) => {
    setCurrentId(id);
  }, []);

  const createNew = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('sessions')
      .insert({})
      .select('id, title, messages, updated_at, active_perfil_id')
      .single();
    if (error || !data) {
      console.warn('[useChatSessionsRemote] createNew failed:', error);
      return;
    }
    const fresh = rowToSession(data as DBRow);
    setSessions((prev) => [fresh, ...prev]);
    setCurrentId(fresh.id);
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      const sb = supabaseBrowser();
      const { error } = await sb.from('sessions').delete().eq('id', id);
      if (error) {
        console.warn('[useChatSessionsRemote] delete failed:', error);
        return;
      }
      const remaining = sessions.filter((s) => s.id !== id);
      setSessions(remaining);
      if (id === currentId) {
        if (remaining.length > 0) {
          setCurrentId(remaining[0]!.id);
        } else {
          await createNew();
        }
      }
    },
    [createNew, currentId, sessions],
  );

  const updateMessages = useCallback(
    async (messages: ChatMessage[]) => {
      const updatedAt = Date.now();
      // Provisional title = a primeira pergunta do usuário (truncada). Mostra
      // algo já e — crucial — é PERSISTIDO no DB quando o título ainda é o
      // default, pra a conversa nunca ficar "Nova conversa" após reload mesmo
      // que o resumo do servidor falhe. Guard pelo título atual evita clobber
      // de um resumo/rename já existente.
      const provisional = deriveTitle(messages);
      const currentTitle =
        sessions.find((s) => s.id === currentId)?.title ?? 'Nova conversa';
      const persistProvisional =
        currentTitle === 'Nova conversa' && provisional !== 'Nova conversa';
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentId
            ? {
                ...s,
                messages,
                title: s.title === 'Nova conversa' ? provisional : s.title,
                updatedAt,
              }
            : s,
        ),
      );
      const sb = supabaseBrowser();
      const payload: Record<string, unknown> = {
        messages,
        updated_at: new Date(updatedAt).toISOString(),
      };
      if (persistProvisional) payload.title = provisional;
      const { error } = await sb.from('sessions').update(payload).eq('id', currentId);
      if (error) {
        console.warn('[useChatSessionsRemote] update failed:', error);
      }
    },
    [currentId, sessions],
  );

  const renameSession = useCallback(async (id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    // Optimistic local update; no updated_at bump so the list doesn't reorder.
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: clean } : s)),
    );
    const sb = supabaseBrowser();
    const { error } = await sb.from('sessions').update({ title: clean }).eq('id', id);
    if (error) {
      console.warn('[useChatSessionsRemote] rename failed:', error);
    }
  }, []);

  const setTitleLocal = useCallback((id: string, title: string) => {
    if (!title) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s)),
    );
    // Persiste o resumo do título no DB também (não confia só no persist do
    // servidor, que pode falhar) — sobrevive a reload e faz upgrade do
    // provisório.
    void supabaseBrowser()
      .from('sessions')
      .update({ title })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.warn('[useChatSessionsRemote] setTitleLocal persist failed:', error.message);
        }
      });
  }, []);

  // Sub-projeto 34 — client-only state for the active Perfil. The actual
  // DB write happens in /api/chat onFinish (when the user sends a turn).
  // That way the UX "aplica do próximo turno em diante" is implicit:
  // picking without sending = transient.
  const setActivePerfil = useCallback(
    (perfilId: string | null) => {
      if (!currentId) return;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentId ? { ...s, activePerfilId: perfilId } : s,
        ),
      );
    },
    [currentId],
  );

  if (!hydrated) {
    return {
      sessions: [],
      currentId: '',
      current: EMPTY_STUB,
      ratings: new Map(),
      switchTo,
      createNew: createNew as unknown as () => void,
      deleteSession: deleteSession as unknown as (id: string) => void,
      updateMessages: updateMessages as unknown as (messages: ChatMessage[]) => void,
      setTitleLocal,
      renameSession: renameSession as unknown as (id: string, title: string) => void,
      setActivePerfil,
    };
  }

  const current = sessions.find((s) => s.id === currentId) ?? sessions[0] ?? EMPTY_STUB;

  return {
    sessions,
    currentId,
    current,
    ratings,
    switchTo,
    createNew: createNew as unknown as () => void,
    deleteSession: deleteSession as unknown as (id: string) => void,
    updateMessages: updateMessages as unknown as (messages: ChatMessage[]) => void,
    setTitleLocal,
    renameSession: renameSession as unknown as (id: string, title: string) => void,
    setActivePerfil,
  };
}
