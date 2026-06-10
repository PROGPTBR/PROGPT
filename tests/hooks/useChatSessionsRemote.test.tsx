// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import type { ChatMessage } from '@/lib/rag/types';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => cleanup());

type Row = { id: string; title: string; messages: ChatMessage[]; updated_at: string };

function mockBrowser(opts: {
  initialRows?: Row[];
  insertRow?: Row;
  insertError?: { message: string } | null;
  updateError?: { message: string } | null;
  deleteError?: { message: string } | null;
}) {
  const insertCalls: Array<Record<string, unknown>> = [];
  const updateCalls: Array<Record<string, unknown>> = [];
  const deleteCalls: string[] = [];

  function builder() {
    let action: 'select' | 'insert' | 'update' | 'delete' | null = null;
    let pendingPayload: Record<string, unknown> | null = null;
    return {
      select: vi.fn().mockImplementation(function (this: any) {
        action = action ?? 'select';
        return this;
      }),
      order: vi.fn().mockImplementation(async () => ({
        data: opts.initialRows ?? [],
        error: null,
      })),
      insert: vi.fn().mockImplementation(function (this: any, payload: Record<string, unknown>) {
        action = 'insert';
        pendingPayload = payload;
        insertCalls.push(payload);
        return this;
      }),
      single: vi.fn().mockImplementation(async () => ({
        data: opts.insertRow ?? null,
        error: opts.insertError ?? null,
      })),
      update: vi.fn().mockImplementation(function (this: any, payload: Record<string, unknown>) {
        action = 'update';
        pendingPayload = payload;
        return this;
      }),
      delete: vi.fn().mockImplementation(function (this: any) {
        action = 'delete';
        return this;
      }),
      eq: vi.fn().mockImplementation(async (_col: string, val: string) => {
        if (action === 'update') {
          updateCalls.push({ id: val, ...(pendingPayload ?? {}) });
          return { error: opts.updateError ?? null };
        }
        if (action === 'delete') {
          deleteCalls.push(val);
          return { error: opts.deleteError ?? null };
        }
        return { error: null };
      }),
    };
  }

  vi.doMock('@/lib/db/supabase-browser', () => ({
    supabaseBrowser: () => ({ from: () => builder() }),
  }));

  return { insertCalls, updateCalls, deleteCalls };
}

const isoNow = () => new Date().toISOString();

describe('useChatSessionsRemote', () => {
  it('auto-creates one session on mount when DB returns no rows', async () => {
    const fresh: Row = { id: 'new-1', title: 'Nova conversa', messages: [], updated_at: isoNow() };
    mockBrowser({ initialRows: [], insertRow: fresh });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });
    expect(result.current.currentId).toBe('new-1');
    expect(result.current.current.id).toBe('new-1');
    expect(result.current.current.messages).toEqual([]);
  });

  // Decisão 2026-06-10: abrir o chat sempre cai numa conversa NOVA (não na
  // última aberta). Reusa sessão vazia existente; senão cria uma fresca.
  it('on mount selects an existing EMPTY session instead of the newest with messages', async () => {
    const rows: Row[] = [
      { id: 'a', title: 'recent', messages: [{ role: 'user', content: 'hi' }], updated_at: '2026-05-02T10:00:00Z' },
      { id: 'b', title: 'Nova conversa', messages: [], updated_at: '2026-05-01T10:00:00Z' },
    ];
    const m = mockBrowser({ initialRows: rows });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(2);
    });
    expect(result.current.currentId).toBe('b'); // a vazia, não a mais recente
    expect(result.current.current.messages).toHaveLength(0);
    expect(m.insertCalls).toHaveLength(0); // reusa — não cria linha nova
  });

  it('on mount creates a fresh session when every existing one has messages', async () => {
    const rows: Row[] = [
      { id: 'a', title: 'recent', messages: [{ role: 'user', content: 'hi' }], updated_at: '2026-05-02T10:00:00Z' },
    ];
    const fresh: Row = { id: 'new-1', title: 'Nova conversa', messages: [], updated_at: isoNow() };
    const m = mockBrowser({ initialRows: rows, insertRow: fresh });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(2);
    });
    expect(result.current.currentId).toBe('new-1');
    expect(result.current.sessions[0]!.id).toBe('new-1'); // prepended
    expect(result.current.sessions[1]!.id).toBe('a'); // histórico preservado
    expect(m.insertCalls).toHaveLength(1);
  });

  it('on mount falls back to the newest session when the fresh insert fails', async () => {
    const rows: Row[] = [
      { id: 'a', title: 'recent', messages: [{ role: 'user', content: 'hi' }], updated_at: '2026-05-02T10:00:00Z' },
    ];
    mockBrowser({ initialRows: rows, insertError: { message: 'boom' } });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });
    expect(result.current.currentId).toBe('a'); // comportamento antigo
    expect(result.current.current.title).toBe('recent');
  });

  it('createNew inserts a row, prepends to local state, switches currentId', async () => {
    const initial: Row = { id: 'a', title: 'first', messages: [], updated_at: '2026-05-02T10:00:00Z' };
    const fresh: Row = { id: 'b', title: 'Nova conversa', messages: [], updated_at: '2026-05-02T11:00:00Z' };
    const m = mockBrowser({ initialRows: [initial], insertRow: fresh });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    await act(async () => {
      await result.current.createNew();
    });
    await waitFor(() => expect(result.current.sessions).toHaveLength(2));
    expect(result.current.currentId).toBe('b');
    expect(result.current.sessions[0]!.id).toBe('b');
    expect(result.current.sessions[1]!.id).toBe('a');
    expect(m.insertCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('updateMessages writes messages to DB (no title — server owns it) and applies a provisional client title while default', async () => {
    const initial: Row = { id: 'a', title: 'Nova conversa', messages: [], updated_at: '2026-05-02T10:00:00Z' };
    const m = mockBrowser({ initialRows: [initial] });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    const msgs: ChatMessage[] = [
      { role: 'user', content: 'O que é Kraljic?' },
      { role: 'assistant', content: 'A matriz...' },
    ];
    await act(async () => {
      await result.current.updateMessages(msgs);
    });
    expect(result.current.current.messages).toEqual(msgs);
    // Client applies a provisional title because the existing one was the
    // default 'Nova conversa' — gives the sidebar something to show while
    // the server-side LLM summary streams in via the annotation.
    expect(result.current.current.title).toBe('O que é Kraljic?');
    expect(m.updateCalls.length).toBe(1);
    expect(m.updateCalls[0]!.id).toBe('a');
    // The provisional title (first question) IS now persisted while the DB
    // title is still the default — so a reloaded conversation never stays
    // "Nova conversa" even if the server-side summary fails. The LLM summary
    // upgrades it later via setTitleLocal.
    expect(m.updateCalls[0]!.title).toBe('O que é Kraljic?');
    expect(m.updateCalls[0]!.messages).toEqual(msgs);
  });

  it('updateMessages preserves an existing non-default title (does not clobber server summary)', async () => {
    const initial: Row = {
      id: 'a',
      title: 'Aplicar Kraljic em Embalagens',
      messages: [],
      updated_at: '2026-05-02T10:00:00Z',
    };
    const m = mockBrowser({ initialRows: [initial] });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    const msgs: ChatMessage[] = [
      { role: 'user', content: 'Como aplicar Kraljic?' },
      { role: 'assistant', content: 'A matriz...' },
    ];
    await act(async () => {
      await result.current.updateMessages(msgs);
    });
    // Existing summary stays — client must not overwrite it.
    expect(result.current.current.title).toBe('Aplicar Kraljic em Embalagens');
    expect(m.updateCalls[0]!.title).toBeUndefined();
  });

  it('setTitleLocal updates the list AND persists the title to DB (survives reload)', async () => {
    const initial: Row = { id: 'a', title: 'Nova conversa', messages: [], updated_at: '2026-05-02T10:00:00Z' };
    const m = mockBrowser({ initialRows: [initial] });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    act(() => {
      result.current.setTitleLocal?.('a', 'Estratégia para TI');
    });
    expect(result.current.current.title).toBe('Estratégia para TI');
    // Now persisted to the DB so the LLM summary survives reload even when the
    // server-side title write fails.
    await waitFor(() => {
      expect(
        m.updateCalls.some((c) => c.id === 'a' && c.title === 'Estratégia para TI'),
      ).toBe(true);
    });
  });

  it('renameSession writes the trimmed title to DB and updates local state', async () => {
    const rows: Row[] = [
      { id: 'a', title: 'Nova conversa', messages: [], updated_at: '2026-05-02T10:00:00Z' },
      { id: 'b', title: 'two', messages: [], updated_at: '2026-05-02T09:00:00Z' },
    ];
    const m = mockBrowser({ initialRows: rows });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => expect(result.current.sessions).toHaveLength(2));
    await act(async () => {
      await result.current.renameSession!('a', '  Estratégia de TI  ');
    });
    expect(result.current.sessions.find((s) => s.id === 'a')!.title).toBe(
      'Estratégia de TI',
    );
    expect(
      m.updateCalls.some((c) => c.id === 'a' && c.title === 'Estratégia de TI'),
    ).toBe(true);
  });

  it('renameSession ignores a blank/whitespace title (no DB write, keeps old title)', async () => {
    const rows: Row[] = [
      { id: 'a', title: 'keep', messages: [], updated_at: '2026-05-02T10:00:00Z' },
    ];
    const m = mockBrowser({ initialRows: rows });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    const before = m.updateCalls.length;
    await act(async () => {
      await result.current.renameSession!('a', '   ');
    });
    expect(result.current.current.title).toBe('keep');
    expect(m.updateCalls.length).toBe(before);
  });

  it('deleteSession removes the row from DB and from local state; switches current if deleted was current', async () => {
    const rows: Row[] = [
      { id: 'a', title: 'one', messages: [], updated_at: '2026-05-02T10:00:00Z' },
      { id: 'b', title: 'two', messages: [], updated_at: '2026-05-02T09:00:00Z' },
    ];
    const m = mockBrowser({ initialRows: rows });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => expect(result.current.sessions).toHaveLength(2));
    expect(result.current.currentId).toBe('a');
    await act(async () => {
      await result.current.deleteSession('a');
    });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.currentId).toBe('b');
    expect(m.deleteCalls).toContain('a');
  });
});
