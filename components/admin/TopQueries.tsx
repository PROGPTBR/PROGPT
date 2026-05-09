'use client';

type Row = { content: string; count: number };

export function TopQueries({ rows, loading }: { rows: Row[]; loading: boolean }) {
  return (
    <section className="rounded-md border border-border bg-card p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Top queries · últimos 30 dias
      </h3>
      {loading && <p className="text-xs text-muted-foreground">Carregando…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">Sem queries no período.</p>
      )}
      {!loading && rows.length > 0 && (
        <ul className="space-y-1 text-xs">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate flex-1">{r.content}</span>
              <span className="tabular-nums text-muted-foreground">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
