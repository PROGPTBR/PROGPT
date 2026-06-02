'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import type { UF } from '@/lib/suppliers/types';

// Item 5 (retenção) — saved supplier searches. User-owned rows in the main
// Supabase (RLS owner-only); supplier DATA stays in the external Receita DB.
// Client-side CRUD via supabaseBrowser, same pattern as useChatSessionsRemote.

export type SavedSupplierSearch = {
  id: string;
  label: string;
  cnae: string;
  cnaeName: string | null;
  ufs: UF[];
  createdAt: number;
};

type Row = {
  id: string;
  label: string;
  cnae: string;
  cnae_name: string | null;
  ufs: string[] | null;
  created_at: string;
};

const COLS = 'id, label, cnae, cnae_name, ufs, created_at';

function rowToSearch(r: Row): SavedSupplierSearch {
  return {
    id: r.id,
    label: r.label,
    cnae: r.cnae,
    cnaeName: r.cnae_name,
    ufs: (r.ufs ?? []) as UF[],
    createdAt: new Date(r.created_at).getTime(),
  };
}

function sameUfs(a: UF[], b: UF[]): boolean {
  return a.length === b.length && a.every((u) => b.includes(u));
}

export type UseSupplierSearches = {
  searches: SavedSupplierSearch[];
  loading: boolean;
  saveSearch: (s: {
    label: string;
    cnae: string;
    cnaeName: string | null;
    ufs: UF[];
  }) => Promise<SavedSupplierSearch | null>;
  deleteSearch: (id: string) => Promise<void>;
};

export function useSupplierSearches(): UseSupplierSearches {
  const [searches, setSearches] = useState<SavedSupplierSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from('supplier_searches')
        .select(COLS)
        .order('created_at', { ascending: false })
        .limit(12);
      if (cancelled) return;
      if (error) {
        console.warn('[useSupplierSearches] load failed:', error.message);
      } else if (data) {
        setSearches((data as Row[]).map(rowToSearch));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSearch = useCallback<UseSupplierSearches['saveSearch']>(async (s) => {
    const label = s.label.trim();
    if (!label) return null;
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('supplier_searches')
      .insert({ label, cnae: s.cnae, cnae_name: s.cnaeName, ufs: s.ufs })
      .select(COLS)
      .single();
    if (error || !data) {
      console.warn('[useSupplierSearches] save failed:', error?.message);
      return null;
    }
    const fresh = rowToSearch(data as Row);
    // De-dup the on-screen list: a re-saved (cnae, ufs) replaces the old entry.
    setSearches((prev) => [
      fresh,
      ...prev.filter((x) => !(x.cnae === fresh.cnae && sameUfs(x.ufs, fresh.ufs))),
    ]);
    return fresh;
  }, []);

  const deleteSearch = useCallback<UseSupplierSearches['deleteSearch']>(async (id) => {
    const sb = supabaseBrowser();
    const { error } = await sb.from('supplier_searches').delete().eq('id', id);
    if (error) {
      console.warn('[useSupplierSearches] delete failed:', error.message);
      return;
    }
    setSearches((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return { searches, loading, saveSearch, deleteSearch };
}
