'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { classifyUpsert } from '@/lib/import-diff';
import {
  codigoOf,
  type MaterialPatch,
  type NewMaterialInput,
  type SavedMaterial,
} from '@/lib/materials/base';

// "Minha base de materiais" — SKU master owner-scoped (RLS) na main
// Supabase. Espelha hooks/useSupplierBase.ts (mesmo padrão de CRUD
// client-side) e acrescenta `applyImport` pro fluxo de planilha do Batch L
// do backlog do diretor (upsert por código + preview "N novos · N
// atualizados").

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

const COLS =
  'id, codigo, descricao, categoria, unidade, ncm, fornecedor_padrao_cnpj, preco_ultimo, moeda, created_at, updated_at';

function rowToMaterial(r: Row): SavedMaterial {
  return {
    id: r.id,
    codigo: r.codigo,
    descricao: r.descricao,
    categoria: r.categoria,
    unidade: r.unidade,
    ncm: r.ncm,
    fornecedorPadraoCnpj: r.fornecedor_padrao_cnpj,
    precoUltimo: r.preco_ultimo,
    moeda: r.moeda,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

function inputToRow(input: NewMaterialInput): Record<string, unknown> {
  return {
    codigo: codigoOf(input.codigo),
    descricao: input.descricao,
    categoria: input.categoria ?? null,
    unidade: input.unidade ?? null,
    ncm: input.ncm ?? null,
    fornecedor_padrao_cnpj: input.fornecedorPadraoCnpj ?? null,
    preco_ultimo: input.precoUltimo ?? null,
    moeda: input.moeda ?? null,
  };
}

function patchToRow(patch: MaterialPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.descricao !== undefined) out.descricao = patch.descricao;
  if (patch.categoria !== undefined) out.categoria = patch.categoria;
  if (patch.unidade !== undefined) out.unidade = patch.unidade;
  if (patch.ncm !== undefined) out.ncm = patch.ncm;
  if (patch.fornecedorPadraoCnpj !== undefined) out.fornecedor_padrao_cnpj = patch.fornecedorPadraoCnpj;
  if (patch.precoUltimo !== undefined) out.preco_ultimo = patch.precoUltimo;
  if (patch.moeda !== undefined) out.moeda = patch.moeda;
  return out;
}

export type ImportSummary = { inserted: number; updated: number; failed: number };

export type UseMaterialsBase = {
  materials: SavedMaterial[];
  loading: boolean;
  addManual: (input: NewMaterialInput) => Promise<SavedMaterial | null>;
  updateMaterial: (id: string, patch: MaterialPatch) => Promise<boolean>;
  deleteMaterial: (id: string) => Promise<void>;
  /** Preview puro (sem gravar) — pra a UI mostrar "N novos · N atualizados" antes de confirmar. */
  previewImport: (rows: NewMaterialInput[]) => { novos: number; atualizados: number };
  /** Grava o import: insert em lote pros novos, update por id pros que já existem (por código). */
  applyImport: (rows: NewMaterialInput[]) => Promise<ImportSummary>;
};

export function useMaterialsBase(): UseMaterialsBase {
  const [materials, setMaterials] = useState<SavedMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('materials')
      .select(COLS)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[useMaterialsBase] load failed:', error.message);
    } else if (data) {
      setMaterials((data as Row[]).map(rowToMaterial));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byCodigo = useMemo(() => {
    const m = new Map<string, SavedMaterial>();
    for (const mat of materials) if (mat.codigo) m.set(mat.codigo, mat);
    return m;
  }, [materials]);

  const addManual = useCallback<UseMaterialsBase['addManual']>(async (input) => {
    const descricao = input.descricao.trim();
    if (!descricao) return null;
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('materials')
      .insert(inputToRow({ ...input, descricao }))
      .select(COLS)
      .single();
    if (error || !data) {
      console.warn('[useMaterialsBase] addManual failed:', error?.message);
      return null;
    }
    const fresh = rowToMaterial(data as Row);
    setMaterials((prev) => [fresh, ...prev]);
    return fresh;
  }, []);

  const updateMaterial = useCallback<UseMaterialsBase['updateMaterial']>(async (id, patch) => {
    const sb = supabaseBrowser();
    const row = { ...patchToRow(patch), updated_at: new Date().toISOString() };
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m)));
    const { error } = await sb.from('materials').update(row).eq('id', id);
    if (error) {
      console.warn('[useMaterialsBase] update failed:', error.message);
      return false;
    }
    return true;
  }, []);

  const deleteMaterial = useCallback<UseMaterialsBase['deleteMaterial']>(
    async (id) => {
      const sb = supabaseBrowser();
      const prev = materials;
      setMaterials((p) => p.filter((m) => m.id !== id));
      const { error } = await sb.from('materials').delete().eq('id', id);
      if (error) {
        console.warn('[useMaterialsBase] delete failed:', error.message);
        setMaterials(prev);
      }
    },
    [materials],
  );

  const previewImport = useCallback<UseMaterialsBase['previewImport']>(
    (rows) => {
      const { novos, atualizados, semChave } = classifyUpsert(
        new Set(byCodigo.keys()),
        rows,
        (r) => codigoOf(r.codigo),
      );
      // Linhas sem código contam como novo cadastro (não há como saber se é update).
      return { novos: novos.length + semChave.length, atualizados: atualizados.length };
    },
    [byCodigo],
  );

  const applyImport = useCallback<UseMaterialsBase['applyImport']>(
    async (rows) => {
      const { novos, atualizados, semChave } = classifyUpsert(
        new Set(byCodigo.keys()),
        rows,
        (r) => codigoOf(r.codigo),
      );
      const sb = supabaseBrowser();
      let inserted = 0;
      let updated = 0;
      let failed = 0;

      const toInsert = [...novos, ...semChave];
      if (toInsert.length > 0) {
        const { data, error } = await sb
          .from('materials')
          .insert(toInsert.map(inputToRow))
          .select(COLS);
        if (error) {
          console.warn('[useMaterialsBase] applyImport insert failed:', error.message);
          failed += toInsert.length;
        } else {
          inserted += data?.length ?? 0;
        }
      }

      for (const r of atualizados) {
        const existing = byCodigo.get(codigoOf(r.codigo)!);
        if (!existing) {
          failed++;
          continue;
        }
        const { error } = await sb
          .from('materials')
          .update({ ...inputToRow(r), updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) {
          console.warn('[useMaterialsBase] applyImport update failed:', error.message);
          failed++;
        } else {
          updated++;
        }
      }

      await load();
      return { inserted, updated, failed };
    },
    [byCodigo, load],
  );

  return { materials, loading, addManual, updateMaterial, deleteMaterial, previewImport, applyImport };
}
