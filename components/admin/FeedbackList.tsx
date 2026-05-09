'use client';

import { Button } from '@/components/ui/button';
import type { FeedbackRow } from '@/lib/feedback';

export type Filters = {
  rating?: 'up' | 'down';
  resolved: boolean; // false = unresolved (default), true = resolved
  hasComment?: boolean;
};

type Props = {
  rows: FeedbackRow[];
  selectedId: string | null;
  filters: Filters;
  onSelect: (id: string) => void;
  onFilterChange: (next: Filters) => void;
};

export function FeedbackList({ rows, selectedId, filters, onSelect, onFilterChange }: Props) {
  return (
    <div className="border border-border rounded-md bg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 text-xs">
        <FilterButton
          label="👍 Positivos"
          active={filters.rating === 'up'}
          onClick={() => onFilterChange({ ...filters, rating: filters.rating === 'up' ? undefined : 'up' })}
        />
        <FilterButton
          label="👎 Negativos"
          active={filters.rating === 'down'}
          onClick={() => onFilterChange({ ...filters, rating: filters.rating === 'down' ? undefined : 'down' })}
        />
        <FilterButton
          label="Apenas com comentário"
          active={filters.hasComment === true}
          onClick={() => onFilterChange({ ...filters, hasComment: filters.hasComment ? undefined : true })}
        />
        <FilterButton
          label={filters.resolved ? 'Exibir pendentes' : 'Exibir tratados'}
          active={false}
          onClick={() => onFilterChange({ ...filters, resolved: !filters.resolved })}
        />
      </div>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="text-left p-2 w-10">Rating</th>
            <th className="text-left p-2">Comentário</th>
            <th className="text-left p-2 w-32">Data</th>
            <th className="text-left p-2 w-24">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="p-4 text-center text-muted-foreground">
                Sem feedback no filtro atual.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`cursor-pointer border-t border-border ${
                selectedId === r.id ? 'bg-primary/10' : 'hover:bg-accent'
              }`}
            >
              <td className="p-2 text-base">{r.rating === 'up' ? '👍' : '👎'}</td>
              <td className="p-2 truncate max-w-md">
                {r.comment ? r.comment.slice(0, 80) : <span className="text-muted-foreground italic">(sem comentário)</span>}
              </td>
              <td className="p-2 tabular-nums text-muted-foreground">
                {new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td className="p-2">
                {r.resolved_at ? (
                  <span className="text-emerald-600 dark:text-emerald-400">resolvido</span>
                ) : (
                  <span className="text-muted-foreground">aberto</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      onClick={onClick}
      className="h-7 text-xs"
    >
      {label}
    </Button>
  );
}
