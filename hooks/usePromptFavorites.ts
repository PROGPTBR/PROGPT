'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

/**
 * Sub-projeto 32 — favoritos de prompts por usuário.
 *
 * Espelha o padrão DB-backed de useChatSessionsRemote: lê/escreve direto via
 * `supabaseBrowser()` (RLS owner-only garante posse; `prompt_favorites.user_id`
 * tem default auth.uid(), então o insert manda só `prompt_id`).
 *
 * Aceita um set inicial (vindo do server component) pra evitar flash; nesse caso
 * pula a hidratação client-side.
 */
export function usePromptFavorites(initial?: string[]) {
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(initial ?? []),
  );
  const [hydrated, setHydrated] = useState(initial != null);
  // Snapshot atual pra ler dentro do toggle sem depender do closure.
  const favRef = useRef(favorites);
  favRef.current = favorites;

  useEffect(() => {
    if (initial != null) return; // server já forneceu
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from('prompt_favorites')
        .select('prompt_id');
      if (cancelled) return;
      if (!error && data) {
        setFavorites(new Set((data as { prompt_id: string }[]).map((r) => r.prompt_id)));
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  const toggle = useCallback(async (id: string): Promise<boolean> => {
    const wasFav = favRef.current.has(id);
    // Otimista
    setFavorites((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(id);
      else next.add(id);
      return next;
    });

    const sb = supabaseBrowser();
    const { error } = wasFav
      ? await sb.from('prompt_favorites').delete().eq('prompt_id', id)
      : await sb.from('prompt_favorites').insert({ prompt_id: id });

    if (error) {
      // Reverte
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(id);
        else next.delete(id);
        return next;
      });
      return false;
    }
    return true;
  }, []);

  return { favorites, isFavorite, toggle, hydrated };
}
