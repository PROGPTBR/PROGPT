'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  RefreshCw,
  FileText,
  FileSpreadsheet,
  ExternalLink,
  AlertCircle,
  Loader2,
  Search,
  Trash2,
  X,
} from 'lucide-react';

// Sub-projeto 26 — Histórico de RFPs por usuário.
//
// Reads from /api/assistants/runs which returns up to 50 most-recent
// rows of assistant_runs filtered by user_id (service-role + explicit
// owner check). Each row carries enough metadata to render without an
// extra fetch.

type AssistantTypeLocal =
  | 'rfp'
  | 'kraljic'
  | 'porter'
  | 'financial'
  | 'abc'
  | 'profile'
  | 'negotiation'
  | 'scorecard';

type RunSummary = {
  id: string;
  assistant_type: AssistantTypeLocal;
  template_id: string | null;
  params: {
    // RFP
    scope?: string;
    category?: string;
    client?: string;
    // Kraljic
    portfolioName?: string;
    items?: Array<{ name?: string }>;
    // Porter
    categoria?: string;
    segmento?: string;
    // Financial
    supplierName?: string;
    cnpj?: string;
    referenceYear?: string;
    // ABC
    analysisName?: string;
    analysisPeriod?: string;
    // Profile
    nomeCategoria?: string;
    subSegmentos?: string[];
    // Scorecard
    scorecardName?: string;
    suppliers?: Array<{ name?: string }>;
  };
  status: 'running' | 'done' | 'error';
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const PAGE_SIZE = 25;

const TYPE_LABELS: Record<AssistantTypeLocal | 'all', string> = {
  all: 'Todos',
  rfp: 'RFP',
  kraljic: 'Kraljic',
  porter: 'Porter',
  financial: 'Financeiro',
  abc: 'ABC',
  profile: 'Perfil',
  negotiation: 'Negociação',
  scorecard: 'Scorecard',
};

const TYPE_ORDER: Array<AssistantTypeLocal | 'all'> = [
  'all',
  'negotiation',
  'rfp',
  'kraljic',
  'porter',
  'abc',
  'financial',
  'profile',
  'scorecard',
];

export function RfpHistoryList() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AssistantTypeLocal | 'all'>('all');
  const [query, setQuery] = useState('');

  const fetchPage = useCallback(
    async (
      cursor: string | null,
      type: AssistantTypeLocal | 'all',
    ): Promise<{
      runs: RunSummary[];
      nextCursor: string | null;
    }> => {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) qs.set('cursor', cursor);
      if (type !== 'all') qs.set('type', type);
      const res = await fetch(`/api/assistants/runs?${qs.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return (await res.json()) as {
        runs: RunSummary[];
        nextCursor: string | null;
      };
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPage(null, typeFilter);
      setRuns(data.runs);
      setNextCursor(data.nextCursor);
    } catch (err) {
      toast.error('Falha ao carregar histórico', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, [fetchPage, typeFilter]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextCursor, typeFilter);
      setRuns((prev) => [...prev, ...data.runs]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      toast.error('Falha ao carregar mais', { description: String(err) });
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, nextCursor, loadingMore, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(runId: string, scope: string) {
    if (
      !window.confirm(
        `Apagar este histórico?\n\n"${scope}"\n\nEsta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setDeletingId(runId);
    try {
      const res = await fetch(`/api/assistants/runs/${runId}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(`status ${res.status}`);
      }
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      toast.success('Histórico apagado.');
    } catch (err) {
      toast.error('Falha ao apagar', { description: String(err) });
    } finally {
      setDeletingId(null);
    }
  }

  // Busca client-side sobre a página atual (servidor já filtra por tipo).
  const filteredRuns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) => {
      const haystack = [
        r.params.scope,
        r.params.category,
        r.params.client,
        r.params.portfolioName,
        r.params.categoria,
        r.params.segmento,
        r.params.supplierName,
        r.params.cnpj,
        r.params.referenceYear,
        r.params.analysisName,
        r.params.analysisPeriod,
        r.params.nomeCategoria,
        r.params.scorecardName,
        ...(r.params.subSegmentos ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [runs, query]);

  async function downloadBlob(
    runId: string,
    assistantType: AssistantTypeLocal,
    kind: 'docx' | 'xlsx',
  ) {
    const prefix =
      assistantType === 'kraljic'
        ? 'kraljic'
        : assistantType === 'porter'
          ? 'porter'
          : assistantType === 'financial'
            ? 'financial'
            : assistantType === 'abc'
              ? 'abc'
              : assistantType === 'profile'
                ? 'perfil'
                : assistantType === 'negotiation'
                  ? 'negociacao'
                  : assistantType === 'scorecard'
                    ? 'scorecard'
                    : kind === 'docx'
                      ? 'rfp'
                      : 'cotacao';
    const filename = `${prefix}-${runId.slice(0, 8)}.${kind}`;
    const errLabel =
      kind === 'docx' ? 'Falha ao baixar .docx' : 'Falha ao baixar planilha';
    setDownloadingId(`${runId}-${kind}`);
    try {
      const res = await fetch(`/api/assistants/runs/${runId}/${kind}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errLabel, { description: String(err) });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Meus assistentes <span className="text-brand">.</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {loading
              ? 'Carregando…'
              : `${filteredRuns.length} ${filteredRuns.length === 1 ? 'análise mostrada' : 'análises mostradas'}${query || typeFilter !== 'all' ? ` (de ${runs.length} carregadas)` : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          title="Atualizar"
          className="inline-flex items-center justify-center rounded-full border border-border bg-card hover:bg-accent text-foreground w-9 h-9 transition-all duration-300 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Filtros: tipo + busca textual */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-wrap gap-1">
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-md px-2.5 h-8 text-xs font-medium transition-all duration-150 active:scale-95 ${
                typeFilter === t
                  ? 'bg-brand/10 border border-brand/30 text-brand'
                  : 'bg-background border border-border text-foreground/70 hover:bg-accent'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-border" />
        <div className="relative flex-1 min-w-[180px]">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Buscar por nome, categoria, cliente…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md bg-background border border-border pl-8 pr-7 h-8 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-brand transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {!loading && runs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-sm text-muted-foreground">
          <p>Você ainda não criou nenhuma análise.</p>
          <Link
            href="/assistants"
            className="text-brand hover:text-brand/80 transition-colors inline-block mt-3"
          >
            Ver assistentes disponíveis →
          </Link>
        </div>
      )}

      {!loading && runs.length > 0 && filteredRuns.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-sm text-muted-foreground">
          <p>Nenhum resultado bate com esse filtro / busca.</p>
        </div>
      )}

      {filteredRuns.length > 0 && (
        <ul className="space-y-2">
          {filteredRuns.map((r) => {
            const isKraljic = r.assistant_type === 'kraljic';
            const isPorter = r.assistant_type === 'porter';
            const isFinancial = r.assistant_type === 'financial';
            const isAbc = r.assistant_type === 'abc';
            const isProfile = r.assistant_type === 'profile';
            const isNegotiation = r.assistant_type === 'negotiation';
            const isScorecard = r.assistant_type === 'scorecard';
            const scope = isKraljic
              ? (r.params.portfolioName ?? '(portfólio sem nome)')
              : isPorter
                ? (r.params.categoria ?? '(sem categoria)')
                : isFinancial
                  ? (r.params.supplierName ?? '(fornecedor sem nome)')
                  : isAbc
                    ? (r.params.analysisName ?? '(análise sem nome)')
                    : isProfile
                      ? (r.params.nomeCategoria ?? '(categoria sem nome)')
                      : isNegotiation
                        ? (r.params.supplierName ?? '(fornecedor sem nome)')
                        : isScorecard
                          ? (r.params.scorecardName ?? '(scorecard sem nome)')
                          : (r.params.scope ?? '(sem escopo)');
            const category = isKraljic
              ? `${r.params.items?.length ?? 0} item(ns)`
              : isPorter
                ? (r.params.segmento || 'Análise de mercado')
                : isFinancial
                  ? (r.params.referenceYear || 'Análise de fornecedor')
                  : isAbc
                    ? `${r.params.items?.length ?? 0} item(ns)`
                    : isProfile
                      ? `${r.params.subSegmentos?.length ?? 0} sub-segmento(s)`
                      : isNegotiation
                        ? (r.params.category ?? 'Estratégia de negociação')
                        : isScorecard
                          ? `${r.params.suppliers?.length ?? 0} fornecedor(es)`
                          : (r.params.category ?? '—');
            const client =
              isKraljic ||
              isPorter ||
              isFinancial ||
              isAbc ||
              isProfile ||
              isNegotiation ||
              isScorecard
                ? ''
                : (r.params.client ?? '');
            const isDone = r.status === 'done';
            // Porter, Financial, Profile and Negotiation don't produce a .xlsx
            // (Scorecard does — multi-sheet, like Kraljic/ABC).
            const showXlsx = !isPorter && !isFinancial && !isProfile && !isNegotiation;
            return (
              <li
                key={r.id}
                className="rounded-xl border border-border bg-card hover:bg-accent/30 hover:border-brand/30 transition-all duration-300 p-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[260px] space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase rounded-full px-2 py-0.5 bg-brand/10 border border-brand/20 text-brand font-medium tracking-wider">
                        {TYPE_LABELS[r.assistant_type] ?? r.assistant_type}
                      </span>
                      <span className="text-xs text-muted-foreground">{category}</span>
                      <span className="text-xs text-muted-foreground/60">·</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(r.created_at)}
                      </span>
                      {r.status === 'running' && (
                        <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium inline-flex items-center gap-1">
                          <Loader2
                            className="h-2.5 w-2.5 animate-spin"
                            aria-hidden="true"
                          />
                          Gerando
                        </span>
                      )}
                      {r.status === 'error' && (
                        <span className="text-[10px] rounded-full px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400 font-medium inline-flex items-center gap-1">
                          <AlertCircle
                            className="h-2.5 w-2.5"
                            aria-hidden="true"
                          />
                          Erro
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-foreground line-clamp-2">
                      {scope}
                    </div>
                    {client && (
                      <div className="text-xs text-muted-foreground">
                        Comprador: {client}
                      </div>
                    )}
                    {r.status === 'error' && r.error_message && (
                      <div className="text-xs text-red-500 mt-1.5 line-clamp-2">
                        {r.error_message}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/assistants/runs/${r.id}`}
                      className="inline-flex items-center gap-1.5 text-xs rounded-full border border-border bg-card hover:bg-accent text-foreground px-3 h-8 transition-all duration-300 active:scale-95"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Abrir
                    </Link>
                    {showXlsx && (
                      <button
                        type="button"
                        disabled={!isDone || downloadingId === `${r.id}-xlsx`}
                        onClick={() =>
                          downloadBlob(r.id, r.assistant_type, 'xlsx')
                        }
                        title="Planilha"
                        className="inline-flex items-center justify-center rounded-full border border-border bg-card hover:bg-accent text-foreground w-8 h-8 transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <FileSpreadsheet
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!isDone || downloadingId === `${r.id}-docx`}
                      onClick={() =>
                        downloadBlob(r.id, r.assistant_type, 'docx')
                      }
                      title=".docx"
                      className="inline-flex items-center justify-center rounded-full bg-brand text-black hover:bg-brand/90 w-8 h-8 transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === r.id}
                      onClick={() => handleDelete(r.id, scope)}
                      title="Apagar"
                      className="inline-flex items-center justify-center rounded-full border border-border bg-card hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 text-muted-foreground w-8 h-8 transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {deletingId === r.id ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 text-sm rounded-full border border-border bg-card hover:bg-accent text-foreground px-5 h-9 transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Carregando…
              </>
            ) : (
              'Carregar mais'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
