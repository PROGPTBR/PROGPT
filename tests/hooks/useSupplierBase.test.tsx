// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

beforeEach(() => vi.resetModules());
afterEach(() => cleanup());

const NOW = '2026-08-22T10:00:00Z';

type Row = {
  id: string;
  cnpj: string | null;
  cnpj_basico: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  cnae: string | null;
  cnae_name: string | null;
  uf: string | null;
  municipio: string | null;
  telefone: string | null;
  email: string | null;
  categoria: string | null;
  status: string;
  rating: number | null;
  notas: string | null;
  origem: string;
  created_at: string;
  updated_at: string;
};

const baseRow = (over: Partial<Row>): Row => ({
  id: 'x', cnpj: null, cnpj_basico: null, razao_social: 'X', nome_fantasia: null, cnae: null,
  cnae_name: null, uf: null, municipio: null, telefone: null, email: null, categoria: null,
  status: 'prospecto', rating: null, notas: null, origem: 'manual', created_at: NOW, updated_at: NOW,
  ...over,
});

// Mesmo mock genérico de tests/hooks/useMaterialsBase.test.tsx (chain
// select/order, insert(+single opcional), update+eq, delete+eq — thenable
// em qualquer ponto da chain, como o postgrest-js real).
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
            return baseRow({ id: `new-${seq}`, ...(r as Partial<Row>) });
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

describe('useSupplierBase — vendor list import (Batch L)', () => {
  it('previewVendorListImport classifies novos vs atualizados by CNPJ base, without writing', async () => {
    const mock = makeTableMock([baseRow({ id: 's1', cnpj: '12345678000190', cnpj_basico: '12345678' })]);
    mockBrowser(mock);
    const { useSupplierBase } = await import('@/hooks/useSupplierBase');
    const { result } = renderHook(() => useSupplierBase());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const preview = result.current.previewVendorListImport([
      { razaoSocial: 'Já cadastrado', cnpj: '12345678000190' },
      { razaoSocial: 'Novo fornecedor', cnpj: '99988877000111' },
      { razaoSocial: 'Sem CNPJ — também novo' },
    ]);
    expect(preview).toEqual({ novos: 2, atualizados: 1 });
    expect(mock.calls.inserts).toHaveLength(0);
  });

  it('applyVendorListImport insere novos em lote e atualiza existentes por id (CNPJ base)', async () => {
    const mock = makeTableMock([baseRow({ id: 'existing-1', razao_social: 'Antigo', cnpj: '12345678000190', cnpj_basico: '12345678' })]);
    mockBrowser(mock);
    const { useSupplierBase } = await import('@/hooks/useSupplierBase');
    const { result } = renderHook(() => useSupplierBase());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let summary!: { inserted: number; updated: number; failed: number };
    await act(async () => {
      summary = await result.current.applyVendorListImport([
        { razaoSocial: 'Atualizado', cnpj: '12345678000190' },
        { razaoSocial: 'Fornecedor novo', cnpj: '99988877000111' },
      ]);
    });
    expect(summary).toEqual({ inserted: 1, updated: 1, failed: 0 });
    expect(mock.calls.updates).toEqual([{ id: 'existing-1', patch: expect.objectContaining({ razao_social: 'Atualizado' }) }]);
    expect(mock.calls.inserts.map((r) => r.razao_social)).toEqual(['Fornecedor novo']);
  });

  it('applyVendorListImport trata linha sem CNPJ como novo cadastro', async () => {
    const mock = makeTableMock([]);
    mockBrowser(mock);
    const { useSupplierBase } = await import('@/hooks/useSupplierBase');
    const { result } = renderHook(() => useSupplierBase());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let summary!: { inserted: number; updated: number; failed: number };
    await act(async () => {
      summary = await result.current.applyVendorListImport([{ razaoSocial: 'Sem CNPJ' }]);
    });
    expect(summary).toEqual({ inserted: 1, updated: 0, failed: 0 });
  });
});

describe('useSupplierBase — load/addManual (smoke)', () => {
  it('loads suppliers on mount', async () => {
    const mock = makeTableMock([baseRow({ id: 's1', razao_social: 'Fornecedor A' })]);
    mockBrowser(mock);
    const { useSupplierBase } = await import('@/hooks/useSupplierBase');
    const { result } = renderHook(() => useSupplierBase());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.suppliers).toHaveLength(1);
    expect(result.current.suppliers[0]!.razaoSocial).toBe('Fornecedor A');
  });
});
