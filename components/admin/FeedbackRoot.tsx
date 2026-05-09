'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FeedbackList, type Filters } from '@/components/admin/FeedbackList';
import { FeedbackDetail } from '@/components/admin/FeedbackDetail';
import { TopQueries } from '@/components/admin/TopQueries';
import type { FeedbackRow } from '@/lib/feedback';

type Annotation = {
  traceId?: string;
  sources?: Array<{
    articleId?: string;
    articleTitle?: string;
    theme?: string;
    content?: string;
  }>;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  annotations?: Annotation[];
};

export function FeedbackRoot() {
  const [filters, setFilters] = useState<Filters>({ rating: undefined, resolved: false, hasComment: undefined });
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [topRows, setTopRows] = useState<Array<{ content: string; count: number }>>([]);
  const [topLoading, setTopLoading] = useState(true);

  const refetchList = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filters.rating) qs.set('rating', filters.rating);
    qs.set('resolved', filters.resolved ? 'true' : 'false');
    if (filters.hasComment === true) qs.set('has_comment', 'true');
    qs.set('limit', '50');
    qs.set('offset', '0');
    const res = await fetch(`/api/admin/feedback?${qs}`);
    if (!res.ok) {
      toast.error('Falha ao carregar feedback');
      return;
    }
    const body = (await res.json()) as { rows: FeedbackRow[] };
    setRows(body.rows);
  }, [filters]);

  useEffect(() => { void refetchList(); }, [refetchList]);

  // Load session.messages when selection changes (admin route, service-role)
  useEffect(() => {
    if (!selectedId) {
      setSessionMessages([]);
      return;
    }
    const item = rows.find((r) => r.id === selectedId);
    if (!item) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/sessions/${item.session_id}/messages`);
      if (!res.ok) return;
      const body = (await res.json()) as { messages: Message[] };
      if (!cancelled) setSessionMessages(body.messages);
    })();
    return () => { cancelled = true; };
  }, [selectedId, rows]);

  // Initial top queries fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/feedback/top-queries?days=30&limit=10');
        if (!res.ok) return;
        const body = (await res.json()) as { rows: Array<{ content: string; count: number }> };
        if (!cancelled) setTopRows(body.rows);
      } finally {
        if (!cancelled) setTopLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleResolve(resolved: boolean) {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/feedback/${selectedId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    });
    if (!res.ok) {
      toast.error('Falha ao salvar');
      return;
    }
    toast.success(resolved ? 'Marcado como resolvido' : 'Reaberto');
    await refetchList();
    if (filters.resolved !== resolved) setSelectedId(null);
  }

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Feedback</h2>
        <p className="text-xs text-muted-foreground">
          Loop de revisão dos 👍/👎 dos usuários. Marque como resolvido depois de agir.
        </p>
      </div>
      <TopQueries rows={topRows} loading={topLoading} />
      <div className="grid grid-cols-[1.4fr_1fr] gap-4 min-h-[420px]">
        <FeedbackList
          rows={rows}
          selectedId={selectedId}
          filters={filters}
          onSelect={setSelectedId}
          onFilterChange={setFilters}
        />
        <div className="bg-card border border-border rounded-md">
          {selected ? (
            <FeedbackDetail
              item={selected}
              sessionMessages={sessionMessages}
              onResolve={handleResolve}
            />
          ) : (
            <div className="p-4 text-xs text-muted-foreground">Selecione um item à esquerda.</div>
          )}
        </div>
      </div>
    </div>
  );
}
