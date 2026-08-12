'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import {
  cnpjBasicoOf,
  type NewSupplierInput,
  type SavedSupplier,
  type SupplierPatch,
  type SupplierStatus,
} from '@/lib/suppliers/base';

// "Minha base de fornecedores" — vendor master owner-scoped (RLS) na main
// Supabase. CRUD client-side via supabaseBrowser, mesmo padrão do
// useSupplierSearches. Os dados canônicos seguem na Receita; aqui é o recorte
// curado do usuário.

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
  status: SupplierStatus;
  rating: number | null;
  notas: string | null;
  origem: 'busca' | 'manual' | 'homologacao';
  created_at: string;
  updated_at: string;
};

const COLS =
  'id, cnpj, cnpj_basico, razao_social, nome_fantasia, cnae, cnae_name, uf, municipio, telefone, email, categoria, status, rating, notas, origem, created_at, updated_at';

function rowToSupplier(r: Row): SavedSupplier {
  return {
    id: r.id,
    cnpj: r.cnpj,
    cnpjBasico: r.cnpj_basico,
    razaoSocial: r.razao_social,
    nomeFantasia: r.nome_fantasia,
    cnae: r.cnae,
    cnaeName: r.cnae_name,
    uf: r.uf,
    municipio: r.municipio,
    telefone: r.telefone,
    email: r.email,
    categoria: r.categoria,
    status: r.status,
    rating: r.rating,
    notas: r.notas,
    origem: r.origem,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

function patchToRow(patch: SupplierPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.razaoSocial !== undefined) out.razao_social = patch.razaoSocial;
  if (patch.nomeFantasia !== undefined) out.nome_fantasia = patch.nomeFantasia;
  if (patch.cnae !== undefined) out.cnae = patch.cnae;
  if (patch.cnaeName !== undefined) out.cnae_name = patch.cnaeName;
  if (patch.uf !== undefined) out.uf = patch.uf;
  if (patch.municipio !== undefined) out.municipio = patch.municipio;
  if (patch.telefone !== undefined) out.telefone = patch.telefone;
  if (patch.email !== undefined) out.email = patch.email;
  if (patch.categoria !== undefined) out.categoria = patch.categoria;
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.rating !== undefined) out.rating = patch.rating;
  if (patch.notas !== undefined) out.notas = patch.notas;
  return out;
}

// Dados vindos de um grupo da busca (o card já resolve a matriz).
export type SaveFromSearchInput = {
  cnpj: string | null;
  cnpjBasico: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnae?: string | null;
  cnaeName?: string | null;
  uf?: string | null;
  municipio?: string | null;
  telefone?: string | null;
  email?: string | null;
};

export type UseSupplierBase = {
  suppliers: SavedSupplier[];
  loading: boolean;
  /** CNPJs base já salvos — pra UI da busca marcar "salvo". */
  savedBasicos: Set<string>;
  saveFromSearch: (s: SaveFromSearchInput) => Promise<SavedSupplier | null>;
  addManual: (input: NewSupplierInput) => Promise<SavedSupplier | null>;
  updateSupplier: (id: string, patch: SupplierPatch) => Promise<boolean>;
  deleteSupplier: (id: string) => Promise<void>;
};

export function useSupplierBase(): UseSupplierBase {
  const [suppliers, setSuppliers] = useState<SavedSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from('suppliers')
        .select(COLS)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn('[useSupplierBase] load failed:', error.message);
      } else if (data) {
        setSuppliers((data as Row[]).map(rowToSupplier));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const savedBasicos = useMemo(
    () =>
      new Set(
        suppliers
          .map((s) => s.cnpjBasico)
          .filter((b): b is string => !!b),
      ),
    [suppliers],
  );

  const saveFromSearch = useCallback<UseSupplierBase['saveFromSearch']>(
    async (s) => {
      // Já está na base? devolve o existente (idempotente pro clique repetido).
      const existing = suppliers.find((x) => x.cnpjBasico === s.cnpjBasico);
      if (existing) return existing;

      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from('suppliers')
        .insert({
          cnpj: s.cnpj,
          cnpj_basico: s.cnpjBasico,
          razao_social: s.razaoSocial,
          nome_fantasia: s.nomeFantasia ?? null,
          cnae: s.cnae ?? null,
          cnae_name: s.cnaeName ?? null,
          uf: s.uf ?? null,
          municipio: s.municipio ?? null,
          telefone: s.telefone ?? null,
          email: s.email ?? null,
          status: 'prospecto',
          origem: 'busca',
        })
        .select(COLS)
        .single();
      if (error || !data) {
        // 23505 = já existia (índice único parcial) — trata como sucesso silencioso.
        if (error && error.code !== '23505') {
          console.warn('[useSupplierBase] saveFromSearch failed:', error.message);
        }
        return null;
      }
      const fresh = rowToSupplier(data as Row);
      setSuppliers((prev) => [fresh, ...prev]);
      return fresh;
    },
    [suppliers],
  );

  const addManual = useCallback<UseSupplierBase['addManual']>(async (input) => {
    const razao = input.razaoSocial.trim();
    if (!razao) return null;
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('suppliers')
      .insert({
        cnpj: input.cnpj ?? null,
        cnpj_basico: cnpjBasicoOf(input.cnpj),
        razao_social: razao,
        categoria: input.categoria ?? null,
        uf: input.uf ?? null,
        municipio: input.municipio ?? null,
        telefone: input.telefone ?? null,
        email: input.email ?? null,
        notas: input.notas ?? null,
        status: input.status ?? 'prospecto',
        origem: 'manual',
      })
      .select(COLS)
      .single();
    if (error || !data) {
      console.warn('[useSupplierBase] addManual failed:', error?.message);
      return null;
    }
    const fresh = rowToSupplier(data as Row);
    setSuppliers((prev) => [fresh, ...prev]);
    return fresh;
  }, []);

  const updateSupplier = useCallback<UseSupplierBase['updateSupplier']>(
    async (id, patch) => {
      const sb = supabaseBrowser();
      const row = { ...patchToRow(patch), updated_at: new Date().toISOString() };
      // Otimista.
      setSuppliers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)),
      );
      const { error } = await sb.from('suppliers').update(row).eq('id', id);
      if (error) {
        console.warn('[useSupplierBase] update failed:', error.message);
        return false;
      }
      return true;
    },
    [],
  );

  const deleteSupplier = useCallback<UseSupplierBase['deleteSupplier']>(
    async (id) => {
      const sb = supabaseBrowser();
      const prev = suppliers;
      setSuppliers((p) => p.filter((s) => s.id !== id));
      const { error } = await sb.from('suppliers').delete().eq('id', id);
      if (error) {
        console.warn('[useSupplierBase] delete failed:', error.message);
        setSuppliers(prev); // rollback
      }
    },
    [suppliers],
  );

  return {
    suppliers,
    loading,
    savedBasicos,
    saveFromSearch,
    addManual,
    updateSupplier,
    deleteSupplier,
  };
}
