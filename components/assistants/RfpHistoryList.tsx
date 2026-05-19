'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  RefreshCw,
  FileText,
  FileSpreadsheet,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// Sub-projeto 26 — Histórico de RFPs por usuário.
//
// Reads from /api/assistants/runs which returns up to 50 most-recent
// rows of assistant_runs filtered by user_id (service-role + explicit
// owner check). Each row carries enough metadata to render without an
// extra fetch.

type RunSummary = {
  id: string;
  assistant_type: 'rfp' | 'kraljic' | 'porter' | 'financial';
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

export function RfpHistoryList() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assistants/runs?limit=50', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { runs: RunSummary[] };
      setRuns(data.runs);
    } catch (err) {
      toast.error('Falha ao carregar histórico', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadBlob(
    runId: string,
    assistantType: 'rfp' | 'kraljic' | 'porter' | 'financial',
    kind: 'docx' | 'xlsx',
  ) {
    const prefix =
      assistantType === 'kraljic'
        ? 'kraljic'
        : assistantType === 'porter'
          ? 'porter'
          : assistantType === 'financial'
            ? 'financial'
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
          <p className="text-sm text-gray-400 mt-2">
            {loading
              ? 'Carregando…'
              : `${runs.length} análise${runs.length === 1 ? '' : 's'} salva${runs.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          title="Atualizar"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white w-9 h-9 transition-all duration-300 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {!loading && runs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-sm text-gray-500">
          <p>Você ainda não criou nenhuma análise.</p>
          <Link
            href="/assistants"
            className="text-brand hover:text-brand/80 transition-colors inline-block mt-3"
          >
            Ver assistentes disponíveis →
          </Link>
        </div>
      )}

      {runs.length > 0 && (
        <ul className="space-y-2">
          {runs.map((r) => {
            const isKraljic = r.assistant_type === 'kraljic';
            const isPorter = r.assistant_type === 'porter';
            const isFinancial = r.assistant_type === 'financial';
            const scope = isKraljic
              ? (r.params.portfolioName ?? '(portfólio sem nome)')
              : isPorter
                ? (r.params.categoria ?? '(sem categoria)')
                : isFinancial
                  ? (r.params.supplierName ?? '(fornecedor sem nome)')
                  : (r.params.scope ?? '(sem escopo)');
            const category = isKraljic
              ? `${r.params.items?.length ?? 0} item(ns)`
              : isPorter
                ? (r.params.segmento || 'Análise de mercado')
                : isFinancial
                  ? (r.params.referenceYear || 'Análise de fornecedor')
                  : (r.params.category ?? '—');
            const client =
              isKraljic || isPorter || isFinancial ? '' : (r.params.client ?? '');
            const isDone = r.status === 'done';
            // Porter and Financial don't produce a .xlsx.
            const showXlsx = !isPorter && !isFinancial;
            return (
              <li
                key={r.id}
                className="rounded-xl border border-white/5 bg-[#141414] hover:bg-[#181818] hover:border-white/10 transition-all duration-300 p-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[260px] space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase rounded-full px-2 py-0.5 bg-brand/10 border border-brand/20 text-brand font-medium tracking-wider">
                        {r.assistant_type}
                      </span>
                      <span className="text-xs text-gray-500">{category}</span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-500">
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
                    <div className="text-sm font-medium text-white line-clamp-2">
                      {scope}
                    </div>
                    {client && (
                      <div className="text-xs text-gray-500">
                        Comprador: {client}
                      </div>
                    )}
                    {r.status === 'error' && r.error_message && (
                      <div className="text-xs text-red-400 mt-1.5 line-clamp-2">
                        {r.error_message}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/assistants/runs/${r.id}`}
                      className="inline-flex items-center gap-1.5 text-xs rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-3 h-8 transition-all duration-300 active:scale-95"
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
                        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white w-8 h-8 transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
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
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
