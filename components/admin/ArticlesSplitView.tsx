'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { ArticleDetail, type AdminArticle } from '@/components/admin/ArticleDetail';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { ThemeSidebar, type ThemeFilter } from '@/components/admin/ThemeSidebar';

type ArticleRow = AdminArticle & { chunks_count?: number };
type SortMode = 'recent' | 'alpha' | 'theme';

const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Mais recentes',
  alpha: 'A → Z',
  theme: 'Por tema',
};

function sourceFilename(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const v = (metadata as Record<string, unknown>).source_filename;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function formatIngestedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // pt-BR short form: 11/05/2026 10:39
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ArticlesSplitView() {
  const [rows, setRows] = useState<ArticleRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabaseBrowser()
      .from('articles')
      .select(
        'id, title, author, language, published_at, ingested_at, metadata, source_chars, theme, theme_status, summary',
      )
      .order('ingested_at', { ascending: false })
      .limit(500);
    if (error) {
      toast.error(`Erro ao carregar artigos: ${error.message}`);
      return;
    }
    setRows((data ?? []) as ArticleRow[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchRows();
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchRows]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetchRows();
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => {
    let out = themeFilter === 'all' ? rows : rows.filter((r) => r.theme === themeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (r) => r.title.toLowerCase().includes(q) || (r.author ?? '').toLowerCase().includes(q),
      );
    }
    if (sortMode === 'alpha') {
      out = [...out].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    } else if (sortMode === 'theme') {
      out = [...out].sort((a, b) => {
        const ta = a.theme ?? '';
        const tb = b.theme ?? '';
        if (ta !== tb) return ta.localeCompare(tb, 'pt-BR');
        return a.title.localeCompare(b.title, 'pt-BR');
      });
    }
    // 'recent' = default order from DB (ingested_at desc)
    return out;
  }, [rows, search, themeFilter, sortMode]);

  const detailArticle = rows.find((r) => r.id === selectedId) ?? null;

  // Header checkbox state for filtered rows
  const filteredIds = filtered.map((r) => r.id);
  const selectedInFiltered = filteredIds.filter((id) => selected.has(id));
  const allFilteredSelected = filteredIds.length > 0 && selectedInFiltered.length === filteredIds.length;
  const someFilteredSelected = selectedInFiltered.length > 0 && !allFilteredSelected;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allFilteredSelected) {
      // Deselect all filtered
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all filtered
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    const ids = [...selected];
    try {
      const res = await fetch('/api/admin/articles/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(`Erro ao excluir artigos: ${data.error ?? res.status}`);
        return;
      }
      // Success: remove deleted rows from state
      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelected(new Set());
      if (selectedId && ids.includes(selectedId)) {
        setSelectedId(null);
      }
    } catch {
      toast.error('Erro de rede ao excluir artigos.');
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Artigos</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length}
            {filtered.length !== rows.length ? ` de ${rows.length}` : ''} artigos
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmBulkOpen(true)}
              disabled={bulkDeleting}
            >
              Excluir {selected.size} selecionados
            </Button>
          )}
          <Input
            placeholder="Buscar por título ou autor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <label className="sr-only" htmlFor="articles-sort">
            Ordenar por
          </label>
          <select
            id="articles-sort"
            aria-label="Ordenar por"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {(['recent', 'alpha', 'theme'] as SortMode[]).map((m) => (
              <option key={m} value={m}>
                {SORT_LABELS[m]}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Atualizar lista"
            title="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <ConfirmDelete
        open={confirmBulkOpen}
        onOpenChange={setConfirmBulkOpen}
        title={`Excluir ${selected.size} artigos`}
        description={`Esta ação remove os ${selected.size} artigos selecionados e todos os chunks associados. Não pode ser desfeita.`}
        onConfirm={handleBulkDelete}
      />

      <div className="grid grid-cols-[180px_1.4fr_1fr] gap-0 rounded-md border border-border overflow-hidden bg-card min-h-[420px]">
        <div className="max-h-[600px] overflow-y-auto">
          <ThemeSidebar articles={rows} selected={themeFilter} onSelect={setThemeFilter} />
        </div>
        <div className="border-r border-l border-border max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someFilteredSelected;
                    }}
                    onChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="text-right w-20">Chunks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  data-selected={selectedId === r.id ? 'true' : undefined}
                  className={`cursor-pointer ${selectedId === r.id ? 'bg-primary/10' : 'hover:bg-accent'}`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <TableCell
                    className="w-8 px-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded"
                      checked={selected.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                      aria-label={`Selecionar ${r.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{r.title}</div>
                    {(() => {
                      const fn = sourceFilename(r.metadata);
                      const ts = formatIngestedAt(r.ingested_at);
                      return (
                        <>
                          <div className="text-xs text-muted-foreground font-mono truncate max-w-[420px]">
                            {fn ?? '—'}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {[
                              ts && `ingerido ${ts}`,
                              r.author,
                              (r.language ?? '').toUpperCase(),
                              r.published_at,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {r.chunks_count ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="bg-background">
          <ArticleDetail
            article={detailArticle}
            onDeleted={(id) => {
              setRows((prev) => prev.filter((r) => r.id !== id));
              setSelectedId(null);
              setSelected((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }}
            onUpdated={(id, patch) => {
              setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
            }}
          />
        </div>
      </div>
    </div>
  );
}
