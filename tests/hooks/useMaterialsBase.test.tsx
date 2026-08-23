// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

beforeEach(() => vi.resetModules());
afterEach(() => cleanup());

const NOW = '2026-08-22T10:00:00Z';

type Row = {
  id: string;
  codigo: string | null;
  descricao: string;
  categoria: string | null;
  unidade: string | null;
  ncm: string | null;
  fornecedor_padrao_cnpj: string | null;
  preco_ultimo: number | null;
  moeda: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Generic Supabase-like query-builder mock: every method returns the same
 * object (chainable) which is itself thenable — `await` resolves via the
 * accumulated `mode` (select/insert/update/delete), mirroring how
 * postgrest-js builders work at every step of the chain. Reused across
 * hook tests that talk to owner-RLS tables via supabaseBrowser (Batch L).
 */
function makeTableMock(initial: Row[] = []) {
  let rows = [...initial];
  const calls = { inserts: [] as Record<string, unknown>[], updates: [] as { id: string; patch: unknown }[], deletes: [] as string[] };
  let seq = 0;

  function builder() {
    let mode: 'select' | 'insert' | 'update' | 'delete' | null = null;
    let insertRows: Record<string, unknown>[] | null = null;
    let updateRow: Record<string, unknown> | null = null;
    let single = false;

    const api: Record<string, unknown> = {
      select: () => {
        if (mode === null) mode = 'select';
        return api;
      },
      order: () => api,
      insert: (payload: Record<string, unknown> | Record<string, unknown>[]) => {
        mode = 'insert';
        insertRows = Array.isArray(payload) ? payload : [payload];
        return api;
      },
      single: () => {
        single = true;
        return api;
      },
      update: (payload: Record<string, unknown>) => {
        mode = 'update';
        updateRow = payload;
        return api;
      },
      delete: () => {
        mode = 'delete';
        return api;
      },
      eq: (_col: string, val: string) => {
        if (mode === 'update') {
          calls.updates.push({ id: val, patch: updateRow });
          rows = rows.map((r) => (r.id === val ? ({ ...r, ...updateRow } as Row) : r));
        }
        if (mode === 'delete') {
          calls.deletes.push(val);
          rows = rows.filter((r) => r.id !== val);
        }
        return api;
      },
      then: (resolve: (v: unknown) => void) => {
        if (mode === 'select') {
          resolve({ data: rows, error: null });
        } else if (mode === 'insert') {
          const created = (insertRows ?? []).map((r) => {
            seq++;
            const row = { id: `new-${seq}`, created_at: NOW, updated_at: NOW, ...r } as Row;
            return row;
          });
          calls.inserts.push(...(insertRows ?? []));
          rows = [...created, ...rows];
          resolve(single ? { data: created[0] ?? null, error: created[0] ? null : { message: 'insert failed' } } : { data: created, error: null });
        } else if (mode === 'update' || mode === 'delete') {
          resolve({ error: null });
        }
      },
    };
    return api;
  }

  return { client: { from: () => builder() }, calls, getRows: () => rows };
}

function mockBrowser(mock: ReturnType<typeof makeTableMock>) {
  vi.doMock('@/lib/db/supabase-browser', () => ({ supabaseBrowser: () => mock.client }));
}

describe('useMaterialsBase', () => {
  it('loads materials on mount', async () => {
    const mock = makeTableMock([
      {
        id: 'm1', codigo: 'SKU-1', descricao: 'Chapa de aço', categoria: 'Metais', unidade: 'UN',
        ncm: '72081000', fornecedor_padrao_cnpj: null, preco_ultimo: 10.5, moeda: 'BRL',
        created_at: NOW, updated_at: NOW,
      },
    ]);
    mockBrowser(mock);
    const { useMaterialsBase } = await import('@/hooks/useMaterialsBase');
    const { result } = renderHook(() => useMaterialsBase());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.materials).toHaveLength(1);
    expect(result.current.materials[0]!.codigo).toBe('SKU-1');
    expect(result.current.materials[0]!.precoUltimo).toBe(10.5);
  });

  it('addManual inserts and prepends', async () => {
    const mock = makeTableMock([]);
    mockBrowser(mock);
    const { useMaterialsBase } = await import('@/hooks/useMaterialsBase');
    const { result } = renderHook(() => useMaterialsBase());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addManual({ descricao: 'Parafuso M6' });
    });
    expect(result.current.materials).toHaveLength(1);
    expect(result.current.materials[0]!.descricao).toBe('Parafuso M6');
  });

  it('previewImport classifies novos vs atualizados by código, without writing', async () => {
    const mock = makeTableMock([
      { id: 'm1', codigo: 'SKU-1', descricao: 'Existente', categoria: null, unidade: null, ncm: null, fornecedor_padrao_cnpj: null, preco_ultimo: null, moeda: null, created_at: NOW, updated_at: NOW },
    ]);
    mockBrowser(mock);
    const { useMaterialsBase } = await import('@/hooks/useMaterialsBase');
    const { result } = renderHook(() => useMaterialsBase());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const preview = result.current.previewImport([
      { codigo: 'SKU-1', descricao: 'Atualiza este' },
      { codigo: 'SKU-2', descricao: 'Novo' },
      { descricao: 'Sem código — também novo' },
    ]);
    expect(preview).toEqual({ novos: 2, atualizados: 1 });
    expect(mock.calls.inserts).toHaveLength(0); // preview não grava
  });

  it('applyImport inserts novos em lote e atualiza existentes por id (código)', async () => {
    const mock = makeTableMock([
      { id: 'existing-1', codigo: 'SKU-1', descricao: 'Antigo', categoria: null, unidade: null, ncm: null, fornecedor_padrao_cnpj: null, preco_ultimo: null, moeda: null, created_at: NOW, updated_at: NOW },
    ]);
    mockBrowser(mock);
    const { useMaterialsBase } = await import('@/hooks/useMaterialsBase');
    const { result } = renderHook(() => useMaterialsBase());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let summary!: { inserted: number; updated: number; failed: number };
    await act(async () => {
      summary = await result.current.applyImport([
        { codigo: 'SKU-1', descricao: 'Atualizado' },
        { codigo: 'SKU-2', descricao: 'Novo material' },
      ]);
    });
    expect(summary).toEqual({ inserted: 1, updated: 1, failed: 0 });
    expect(mock.calls.updates).toEqual([{ id: 'existing-1', patch: expect.objectContaining({ descricao: 'Atualizado' }) }]);
    expect(mock.calls.inserts.map((r) => r.codigo)).toEqual(['SKU-2']);
  });

  it('updateMaterial is optimistic and rolls forward on success', async () => {
    const mock = makeTableMock([
      { id: 'm1', codigo: null, descricao: 'X', categoria: null, unidade: null, ncm: null, fornecedor_padrao_cnpj: null, preco_ultimo: null, moeda: null, created_at: NOW, updated_at: NOW },
    ]);
    mockBrowser(mock);
    const { useMaterialsBase } = await import('@/hooks/useMaterialsBase');
    const { result } = renderHook(() => useMaterialsBase());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      const ok = await result.current.updateMaterial('m1', { categoria: 'Nova categoria' });
      expect(ok).toBe(true);
    });
    expect(result.current.materials[0]!.categoria).toBe('Nova categoria');
  });

  it('deleteMaterial removes from the list', async () => {
    const mock = makeTableMock([
      { id: 'm1', codigo: null, descricao: 'X', categoria: null, unidade: null, ncm: null, fornecedor_padrao_cnpj: null, preco_ultimo: null, moeda: null, created_at: NOW, updated_at: NOW },
    ]);
    mockBrowser(mock);
    const { useMaterialsBase } = await import('@/hooks/useMaterialsBase');
    const { result } = renderHook(() => useMaterialsBase());
    await waitFor(() => expect(result.current.materials).toHaveLength(1));
    await act(async () => {
      await result.current.deleteMaterial('m1');
    });
    expect(result.current.materials).toHaveLength(0);
    expect(mock.calls.deletes).toContain('m1');
  });
});
