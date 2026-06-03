// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

beforeEach(() => vi.resetModules());
afterEach(() => cleanup());

function mockBrowser(opts: {
  initial?: { prompt_id: string }[];
  insertError?: boolean;
  deleteError?: boolean;
}) {
  const inserts: Array<Record<string, unknown>> = [];
  const deletes: string[] = [];
  let selectCount = 0;
  function builder() {
    let action: 'delete' | 'insert' | null = null;
    const api: Record<string, unknown> = {};
    Object.assign(api, {
      select: vi.fn(async () => {
        selectCount += 1;
        return { data: opts.initial ?? [], error: null };
      }),
      insert: vi.fn(async (p: Record<string, unknown>) => {
        action = 'insert';
        inserts.push(p);
        return { error: opts.insertError ? { message: 'fail' } : null };
      }),
      delete: vi.fn(() => {
        action = 'delete';
        return api;
      }),
      eq: vi.fn(async (_col: string, val: string) => {
        if (action === 'delete') deletes.push(val);
        return { error: opts.deleteError ? { message: 'fail' } : null };
      }),
    });
    return api;
  }
  vi.doMock('@/lib/db/supabase-browser', () => ({
    supabaseBrowser: () => ({ from: () => builder() }),
  }));
  return { inserts, deletes, selectCount: () => selectCount };
}

describe('usePromptFavorites', () => {
  it('hydrates favorites from the DB on mount', async () => {
    mockBrowser({ initial: [{ prompt_id: 'p1' }, { prompt_id: 'p2' }] });
    const { usePromptFavorites } = await import('@/hooks/usePromptFavorites');
    const { result } = renderHook(() => usePromptFavorites());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.isFavorite('p1')).toBe(true);
    expect(result.current.isFavorite('p2')).toBe(true);
    expect(result.current.isFavorite('p3')).toBe(false);
  });

  it('uses the server-provided initial set and skips the DB read', async () => {
    const m = mockBrowser({ initial: [{ prompt_id: 'zzz' }] });
    const { usePromptFavorites } = await import('@/hooks/usePromptFavorites');
    const { result } = renderHook(() => usePromptFavorites(['a', 'b']));
    expect(result.current.hydrated).toBe(true);
    expect(result.current.isFavorite('a')).toBe(true);
    expect(result.current.isFavorite('zzz')).toBe(false);
    expect(m.selectCount()).toBe(0);
  });

  it('toggle adds a favorite optimistically and inserts', async () => {
    const m = mockBrowser({ initial: [] });
    const { usePromptFavorites } = await import('@/hooks/usePromptFavorites');
    const { result } = renderHook(() => usePromptFavorites([]));
    await act(async () => {
      await result.current.toggle('p9');
    });
    expect(result.current.isFavorite('p9')).toBe(true);
    expect(m.inserts[0]).toEqual({ prompt_id: 'p9' });
  });

  it('toggle removes an existing favorite and deletes', async () => {
    const m = mockBrowser({ initial: [] });
    const { usePromptFavorites } = await import('@/hooks/usePromptFavorites');
    const { result } = renderHook(() => usePromptFavorites(['p1']));
    await act(async () => {
      await result.current.toggle('p1');
    });
    expect(result.current.isFavorite('p1')).toBe(false);
    expect(m.deletes).toContain('p1');
  });

  it('reverts the optimistic add when the insert fails', async () => {
    mockBrowser({ initial: [], insertError: true });
    const { usePromptFavorites } = await import('@/hooks/usePromptFavorites');
    const { result } = renderHook(() => usePromptFavorites([]));
    await act(async () => {
      await result.current.toggle('p5');
    });
    expect(result.current.isFavorite('p5')).toBe(false);
  });
});
