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
import { Button } from '@/components/ui/button';

// Sub-projeto 26 — Histórico de RFPs por usuário.
//
// Reads from /api/assistants/runs which returns up to 50 most-recent
// rows of assistant_runs filtered by user_id (service-role + explicit
// owner check). Each row carries enough metadata (params.scope/category,
// status, dates) to render without an extra fetch.

type RunSummary = {
  id: string;
  assistant_type: 'rfp';
  template_id: string | null;
  params: {
    scope?: string;
    category?: string;
    client?: string;
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
      const res = await fetch('/api/assistants/runs?limit=50', { cache: 'no-store' });
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

  async function downloadBlob(runId: string, kind: 'docx' | 'xlsx') {
    const filename = kind === 'docx' ? `rfp-${runId.slice(0, 8)}.docx` : `cotacao-${runId.slice(0, 8)}.xlsx`;
    const errLabel = kind === 'docx' ? 'Falha ao baixar .docx' : 'Falha ao baixar planilha';
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meus RFPs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Carregando…' : `${runs.length} RFP${runs.length === 1 ? '' : 's'} salvos`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} title="Atualizar">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {!loading && runs.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Você ainda não criou nenhum RFP.{' '}
          <Link href="/assistants/rfp" className="text-primary underline-offset-4 hover:underline">
            Criar o primeiro →
          </Link>
        </div>
      )}

      {runs.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <ul className="divide-y divide-border">
            {runs.map((r) => {
              const scope = r.params.scope ?? '(sem escopo)';
              const category = r.params.category ?? '—';
              const client = r.params.client ?? '';
              const isDone = r.status === 'done';
              return (
                <li key={r.id} className="p-4 bg-card hover:bg-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[260px] space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase rounded px-1.5 py-0.5 bg-primary/10 text-primary font-medium">
                          {r.assistant_type}
                        </span>
                        <span className="text-xs text-muted-foreground">{category}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
                        {r.status === 'running' && (
                          <span className="text-[10px] rounded px-1.5 py-0.5 bg-amber-500/10 text-amber-600 font-medium inline-flex items-center gap-1">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Gerando
                          </span>
                        )}
                        {r.status === 'error' && (
                          <span className="text-[10px] rounded px-1.5 py-0.5 bg-destructive/10 text-destructive font-medium inline-flex items-center gap-1">
                            <AlertCircle className="h-2.5 w-2.5" /> Erro
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium line-clamp-2">{scope}</div>
                      {client && (
                        <div className="text-xs text-muted-foreground">Comprador: {client}</div>
                      )}
                      {r.status === 'error' && r.error_message && (
                        <div className="text-xs text-destructive mt-1 line-clamp-2">
                          {r.error_message}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/assistants/runs/${r.id}`}
                        className="inline-flex items-center gap-1.5 text-xs rounded-md border border-input bg-background hover:bg-accent px-2.5 h-8"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isDone || downloadingId === `${r.id}-xlsx`}
                        onClick={() => downloadBlob(r.id, 'xlsx')}
                        title="Planilha de cotação"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        disabled={!isDone || downloadingId === `${r.id}-docx`}
                        onClick={() => downloadBlob(r.id, 'docx')}
                        title=".docx"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
