'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { CnaeInfo } from '@/lib/suppliers/types';

type Props = {
  value: string;
  onSelect: (cnae: CnaeInfo) => void;
};

const DEBOUNCE_MS = 300;

export function CnaeAutocomplete({ value, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CnaeInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/suppliers/cnae-search?q=${encodeURIComponent(query.trim())}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { results: CnaeInfo[] };
          setResults(data.results);
          setOpen(true);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder={value ? `Trocar (atual: ${value})` : 'Buscar CNAE…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full rounded-lg bg-muted/40 border border-border pl-9 pr-4 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
          {results.map((r) => (
            <button
              key={r.code}
              type="button"
              onClick={() => {
                onSelect(r);
                setQuery('');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border last:border-0 transition-colors"
            >
              <div className="text-xs font-mono text-brand">{r.code}</div>
              <div className="text-sm text-foreground line-clamp-1">{r.name}</div>
              {r.divisao && (
                <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                  {r.divisao}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          …
        </div>
      )}
    </div>
  );
}
