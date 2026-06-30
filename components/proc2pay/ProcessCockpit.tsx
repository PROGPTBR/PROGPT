'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Lock, Loader2, Play, ArrowLeft, ThumbsUp, ThumbsDown } from 'lucide-react';
import { STAGES, isStageComplete, canRunStage } from '@/lib/proc2pay/stages';
import type { Proc2PayProcess, Proc2PayStageRun, Stage, StageId } from '@/lib/proc2pay/types';

const MVP_STAGES = STAGES.filter((s) => s.mvp);

export function ProcessCockpit({
  initialProcess,
  initialStageRuns,
}: {
  initialProcess: Proc2PayProcess;
  initialStageRuns: Proc2PayStageRun[];
}) {
  const [process, setProcess] = useState(initialProcess);
  const [stageRuns, setStageRuns] = useState(initialStageRuns);
  const [busy, setBusy] = useState<StageId | null>(null);
  const [propostas, setPropostas] = useState('');
  const [nota, setNota] = useState('');
  const [comment, setComment] = useState('');

  // Último artefato concluído por etapa.
  const artifacts = useMemo(() => {
    const map: Partial<Record<StageId, string>> = {};
    for (const r of stageRuns) {
      if (r.status === 'concluido' && r.artifact_md) map[r.stage] = r.artifact_md;
    }
    return map;
  }, [stageRuns]);

  async function refresh() {
    const res = await fetch(`/api/proc2pay/processes/${process.id}`);
    if (res.ok) {
      const data = await res.json();
      setProcess(data.process);
      setStageRuns(data.stageRuns);
    }
  }

  async function runStage(stage: StageId) {
    setBusy(stage);
    try {
      const body: Record<string, string> = {};
      if (stage === 'recebimento_propostas') body.propostas = propostas;
      if (stage === 'negociacao' && nota.trim()) body.nota = nota;
      const res = await fetch(`/api/proc2pay/processes/${process.id}/stages/${stage}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Não foi possível executar a etapa.');
        return;
      }
      await refresh();
      toast.success('Etapa concluída.');
    } catch {
      toast.error('Erro de rede.');
    } finally {
      setBusy(null);
    }
  }

  async function approve(decision: 'aprovado' | 'reprovado') {
    setBusy('aprovacao');
    try {
      const res = await fetch(`/api/proc2pay/processes/${process.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment: comment || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Não foi possível registrar a decisão.');
        return;
      }
      await refresh();
      toast.success(decision === 'aprovado' ? 'Aprovado.' : 'Reprovado.');
    } catch {
      toast.error('Erro de rede.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/proc2pay" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Processos
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{process.numero}</div>
          <h1 className="text-2xl font-semibold tracking-tight">{process.titulo}</h1>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${process.state === 'concluido' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'border-brand/40 bg-brand/10 text-brand'}`}>
          {process.state === 'concluido' ? 'Concluído' : 'Em andamento'}
        </span>
      </div>

      <ol className="space-y-3">
        {MVP_STAGES.map((stage) => {
          const done = isStageComplete(stage.id, process.context);
          const runnable = !done && canRunStage(stage.id, process.context);
          const locked = !done && !runnable;
          const artifact = artifacts[stage.id];
          const isBusy = busy === stage.id;

          return (
            <li
              key={stage.id}
              className={`rounded-2xl border p-4 ${done ? 'border-border bg-card' : runnable ? 'border-brand/40 bg-brand/[0.03]' : 'border-border bg-muted/20'}`}
            >
              <div className="flex items-center gap-3">
                <StageIcon done={done} runnable={runnable} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Etapa {stage.num}</div>
                  <div className="font-medium">{stage.label}</div>
                </div>
                {runnable && stage.id !== 'aprovacao' && (
                  <button
                    type="button"
                    onClick={() => runStage(stage.id)}
                    disabled={isBusy || (stage.id === 'recebimento_propostas' && !propostas.trim())}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-black text-sm font-medium h-9 px-4 brand-glow disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Executar
                  </button>
                )}
              </div>

              {/* Inputs específicos da etapa corrente */}
              {runnable && stage.id === 'recebimento_propostas' && (
                <textarea
                  value={propostas}
                  onChange={(e) => setPropostas(e.target.value)}
                  rows={5}
                  placeholder="Cole aqui as propostas dos fornecedores (preço, frete, prazo, condições)…"
                  className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              )}
              {runnable && stage.id === 'negociacao' && (
                <input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Observação para a negociação (opcional)"
                  className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              )}
              {runnable && stage.id === 'aprovacao' && (
                <div className="mt-3 space-y-2">
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Comentário (opcional)"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => approve('aprovado')} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium h-9 px-4 disabled:opacity-50">
                      <ThumbsUp className="h-4 w-4" /> Aprovar
                    </button>
                    <button type="button" onClick={() => approve('reprovado')} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-full border border-border hover:bg-accent text-sm font-medium h-9 px-4 disabled:opacity-50">
                      <ThumbsDown className="h-4 w-4" /> Reprovar
                    </button>
                  </div>
                </div>
              )}

              {locked && (
                <p className="mt-2 text-xs text-muted-foreground">Conclua as etapas anteriores para liberar.</p>
              )}

              {/* Artefato da etapa */}
              {artifact && (
                <details className="mt-3 group" open={done && runnableNext(stage, process)}>
                  <summary className="cursor-pointer text-sm text-brand hover:text-brand/80">Ver resultado</summary>
                  <div className="prose prose-sm dark:prose-invert max-w-none mt-2 rounded-lg border border-border bg-background p-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact}</ReactMarkdown>
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ol>

      {process.state === 'concluido' && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 text-sm text-emerald-700 dark:text-emerald-300">
          ✅ Processo concluído — a ordem de compra foi gerada na última etapa.
        </div>
      )}
    </div>
  );
}

// Abre o artefato da última etapa concluída automaticamente.
function runnableNext(stage: Stage, process: Proc2PayProcess): boolean {
  return process.status === stage.id;
}

function StageIcon({ done, runnable }: { done: boolean; runnable: boolean }) {
  if (done) return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" aria-hidden="true" />;
  if (runnable) return <Circle className="h-5 w-5 text-brand shrink-0" aria-hidden="true" />;
  return <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />;
}
