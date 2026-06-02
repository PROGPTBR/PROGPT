// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

beforeEach(() => vi.resetModules());
afterEach(() => cleanup());

type Row = {
  id: string;
  label: string;
  cnae: string;
  cnae_name: string | null;
  ufs: string[] | null;
  created_at: string;
};

function mockBrowser(opts: { initial?: Row[]; insertRow?: Row }) {
  const inserts: Array<Record<string, unknown>> = [];
  const deletes: string[] = [];
  function builder() {
    let action: 'select' | 'insert' | 'delete' | null = null;
    const api: Record<string, unknown> = {};
    Object.assign(api, {
      select: vi.fn(() => api),
      order: vi.fn(() => api),
      limit: vi.fn(async () => ({ data: opts.initial ?? [], error: null })),
      insert: vi.fn((p: Record<string, unknown>) => {
        action = 'insert';
        inserts.push(p);
        return api;
      }),
      single: vi.fn(async () => ({
        data: opts.insertRow ?? null,
        error: opts.insertRow ? null : { message: 'no row' },
      })),
      delete: vi.fn(() => {
        action = 'delete';
        return api;
      }),
      eq: vi.fn(async (_col: string, val: string) => {
        if (action === 'delete') deletes.push(val);
        return { error: null };
      }),
    });
    return api;
  }
  vi.doMock('@/lib/db/supabase-browser', () => ({
    supabaseBrowser: () => ({ from: () => builder() }),
  }));
  return { inserts, deletes };
}

const isoNow = () => '2026-06-02T10:00:00Z';

describe('useSupplierSearches', () => {
  it('loads saved searches on mount, newest first', async () => {
    mockBrowser({
      initial: [
        { id: 'a', label: 'Embalagens — SP, RJ', cnae: '2222200', cnae_name: 'Fab. embalagens', ufs: ['SP', 'RJ'], created_at: isoNow() },
      ],
    });
    const { useSupplierSearches } = await import('@/hooks/useSupplierSearches');
    const { result } = renderHook(() => useSupplierSearches());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.searches).toHaveLength(1);
    expect(result.current.searches[0]!.label).toBe('Embalagens — SP, RJ');
    expect(result.current.searches[0]!.ufs).toEqual(['SP', 'RJ']);
  });

  it('saveSearch inserts and prepends to the list', async () => {
    const m = mockBrowser({
      initial: [],
      insertRow: { id: 'b', label: 'Químicos — BA', cnae: '2011200', cnae_name: 'Químicos', ufs: ['BA'], created_at: isoNow() },
    });
    const { useSupplierSearches } = await import('@/hooks/useSupplierSearches');
    const { result } = renderHook(() => useSupplierSearches());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveSearch({ label: 'Químicos — BA', cnae: '2011200', cnaeName: 'Químicos', ufs: ['BA'] });
    });
    expect(result.current.searches[0]!.id).toBe('b');
    expect(m.inserts[0]!.label).toBe('Químicos — BA');
    expect(m.inserts[0]!.ufs).toEqual(['BA']);
  });

  it('saveSearch with a blank label is a no-op (no insert)', async () => {
    const m = mockBrowser({ initial: [] });
    const { useSupplierSearches } = await import('@/hooks/useSupplierSearches');
    const { result } = renderHook(() => useSupplierSearches());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveSearch({ label: '   ', cnae: '2011200', cnaeName: null, ufs: [] });
    });
    expect(m.inserts.length).toBe(0);
  });

  it('deleteSearch removes the row from the list', async () => {
    const m = mockBrowser({
      initial: [{ id: 'a', label: 'X', cnae: '2222200', cnae_name: null, ufs: [], created_at: isoNow() }],
    });
    const { useSupplierSearches } = await import('@/hooks/useSupplierSearches');
    const { result } = renderHook(() => useSupplierSearches());
    await waitFor(() => expect(result.current.searches).toHaveLength(1));
    await act(async () => {
      await result.current.deleteSearch('a');
    });
    expect(result.current.searches).toHaveLength(0);
    expect(m.deletes).toContain('a');
  });
});
