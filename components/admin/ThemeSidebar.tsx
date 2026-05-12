'use client';

import { useMemo } from 'react';
import { CANONICAL_THEMES, isCanonicalTheme } from '@/lib/ingest/taxonomy';

export type ThemeFilter = string | 'all';

type Props = {
  articles: Array<{ theme: string; theme_status?: 'canonical' | 'candidate' }>;
  selected: ThemeFilter;
  onSelect: (t: ThemeFilter) => void;
};

export function ThemeSidebar({ articles, selected, onSelect }: Props) {
  const { canonicalCounts, candidates } = useMemo(() => {
    const canonical = new Map<string, number>();
    for (const t of CANONICAL_THEMES) canonical.set(t, 0);
    const candidateMap = new Map<string, number>();
    for (const a of articles) {
      if (a.theme_status === 'candidate' || !isCanonicalTheme(a.theme)) {
        candidateMap.set(a.theme, (candidateMap.get(a.theme) ?? 0) + 1);
      } else {
        canonical.set(a.theme, (canonical.get(a.theme) ?? 0) + 1);
      }
    }
    return {
      canonicalCounts: canonical,
      candidates: [...candidateMap.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [articles]);

  return (
    <nav className="border-r border-border p-2 space-y-0.5 text-sm bg-muted/30">
      <ThemeButton
        label="Todos"
        count={articles.length}
        active={selected === 'all'}
        onClick={() => onSelect('all')}
      />
      <div className="h-px bg-border my-1" />
      {CANONICAL_THEMES.map((t) => (
        <ThemeButton
          key={t}
          label={t}
          count={canonicalCounts.get(t) ?? 0}
          active={selected === t}
          onClick={() => onSelect(t)}
        />
      ))}
      {candidates.length > 0 && (
        <>
          <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            Candidatos · IA propôs
          </div>
          {candidates.map(([theme, count]) => (
            <ThemeButton
              key={theme}
              label={theme}
              count={count}
              active={selected === theme}
              onClick={() => onSelect(theme)}
              candidate
            />
          ))}
        </>
      )}
    </nav>
  );
}

function ThemeButton({
  label,
  count,
  active,
  onClick,
  candidate = false,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  candidate?: boolean;
}) {
  const base = 'flex items-center justify-between w-full px-2 py-1.5 rounded text-left transition-colors';
  const colors = active
    ? 'bg-primary/10 text-primary font-medium'
    : candidate
      ? 'text-amber-900 dark:text-amber-200 hover:bg-amber-100/40 dark:hover:bg-amber-950/40'
      : 'hover:bg-accent';
  const dim = count === 0 && !active ? 'text-muted-foreground' : '';
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
      className={`${base} ${colors} ${dim}`}
      title={candidate ? 'Tema proposto pela IA — promova a canônico se aprovar' : undefined}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums ml-2">{count}</span>
    </button>
  );
}
