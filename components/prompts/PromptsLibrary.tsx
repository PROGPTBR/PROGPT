'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePromptFavorites } from '@/hooks/usePromptFavorites';
import type { PublicPrompt } from '@/lib/prompts/types';
import { PromptDetail } from './PromptDetail';

type CategoryFilter = string | 'all' | '__fav__';

type Props = {
  prompts: PublicPrompt[];
  initialFavorites: string[];
};

export function PromptsLibrary({ prompts, initialFavorites }: Props) {
  const { favorites, isFavorite, toggle } = usePromptFavorites(initialFavorites);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(prompts[0]?.id ?? null);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of prompts) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [prompts]);

  const filtered = useMemo(() => {
    let out = prompts;
    if (category === '__fav__') out = out.filter((p) => favorites.has(p.id));
    else if (category !== 'all') out = out.filter((p) => p.category === category);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.summary.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return out;
  }, [prompts, category, search, favorites]);

  // Mantém uma seleção válida quando o filtro muda.
  useEffect(() => {
    if (!filtered.some((p) => p.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const selected = prompts.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Biblioteca de Prompts <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {prompts.length} prompts de procurement prontos para usar — copie ou mande
          direto pro chat e ajuste os <code className="text-brand">[colchetes]</code>.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[210px_1.3fr_1.1fr] gap-0 rounded-md border border-border overflow-hidden bg-card min-h-[480px]">
        {/* Sidebar de categorias */}
        <nav className="border-b md:border-b-0 md:border-r border-border p-2 space-y-0.5 text-sm bg-muted/30 max-h-[640px] overflow-y-auto">
          <CategoryButton
            label="Todos"
            count={prompts.length}
            active={category === 'all'}
            onClick={() => setCategory('all')}
          />
          <CategoryButton
            label="★ Favoritos"
            count={favorites.size}
            active={category === '__fav__'}
            onClick={() => setCategory('__fav__')}
          />
          <div className="h-px bg-border my-1" />
          {categories.map(([name, count]) => (
            <CategoryButton
              key={name}
              label={name}
              count={count}
              active={category === name}
              onClick={() => setCategory(name)}
            />
          ))}
        </nav>

        {/* Lista + busca */}
        <div className="border-b md:border-b-0 md:border-r border-border flex flex-col max-h-[640px]">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, resumo ou tag…"
                className="pl-8 h-9 text-sm"
                aria-label="Buscar prompts"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">
                Nenhum prompt encontrado.
              </li>
            ) : (
              filtered.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-start gap-1 transition-colors ${
                    p.id === selectedId ? 'bg-primary/10' : 'hover:bg-accent'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    aria-current={p.id === selectedId ? 'true' : undefined}
                    className="min-w-0 flex-1 text-left pl-3 py-2.5"
                  >
                    <div className="text-sm font-medium truncate">{p.title}</div>
                    {p.summary && (
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {p.summary}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground/80 mt-1">
                      {p.category}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggle(p.id)}
                    aria-pressed={isFavorite(p.id)}
                    aria-label={isFavorite(p.id) ? 'Remover dos favoritos' : 'Favoritar'}
                    className="flex-shrink-0 p-2.5"
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${
                        isFavorite(p.id)
                          ? 'fill-brand text-brand'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Detalhe */}
        <div className="bg-background max-h-[640px]">
          <PromptDetail
            prompt={selected}
            isFavorite={selected ? isFavorite(selected.id) : false}
            onToggleFavorite={(id) => void toggle(id)}
          />
        </div>
      </div>
    </div>
  );
}

function CategoryButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={`flex items-center justify-between w-full px-2 py-1.5 rounded text-left transition-colors ${
        active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'
      } ${count === 0 && !active ? 'text-muted-foreground' : ''}`}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums ml-2">{count}</span>
    </button>
  );
}
