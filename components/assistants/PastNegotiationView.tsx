'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  MessageCircle,
  Play,
  RotateCcw,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import type {
  NegotiationScore,
  NegotiationSimulatorSetup,
  NegotiationStrategyParams,
  NegotiationStrategyResult,
  NegotiationTranscriptTurn,
} from '@/lib/assistants/types';
import { NegotiationStrategyResult as NegotiationStrategyResultView } from './NegotiationStrategyResult';
import { NegotiationChat, type Msg } from './NegotiationChat';
import { NegotiationScoreView } from './NegotiationScoreView';
import { NegotiationSimulatorSetupView } from './NegotiationSimulatorSetup';

// Sub-projeto 22 (follow-up²) — visualização + retomar/reiniciar de um
// run salvo de /assistants/negotiation.
//
// Tabs Estratégia / Simulação / Score, plus modos de interação:
//   - "Continuar simulação": carrega transcript salvo no chat ao vivo
//     e o user pode adicionar novos turnos. Endpoint /negotiate aceita.
//   - "Reiniciar simulação": confirma + chama /setup com o setup
//     salvo em params.simulator → opener novo + transcript zerado.
//   - "Encerrar e gerar score": gera novo score via /close (já existia).

type Props = {
  runId: string;
  params: NegotiationStrategyParams;
  strategy: NegotiationStrategyResult | null;
  transcript: NegotiationTranscriptTurn[] | null;
  score: NegotiationScore | null;
};

type Tab = 'strategy' | 'simulation' | 'score';
type Mode = 'view' | 'continuing' | 'restarting' | 'setting-up' | 'closing';

export function PastNegotiationView({
  runId,
  params,
  strategy,
  transcript: initialTranscript,
  score: initialScore,
}: Props) {
  const hasInitialTranscript = (initialTranscript?.length ?? 0) > 0;
  const hasInitialScore = initialScore !== null;
  const [tab, setTab] = useState<Tab>(
    hasInitialScore
      ? 'score'
      : hasInitialTranscript
        ? 'simulation'
        : 'strategy',
  );
  const [mode, setMode] = useState<Mode>('view');
  // Local state pra histórico ativo (continua sendo persistido server-side
  // a cada turno via /negotiate onFinish).
  const [transcript, setTranscript] = useState<NegotiationTranscriptTurn[]>(
    initialTranscript ?? [],
  );
  const [score, setScore] = useState<NegotiationScore | null>(initialScore);
  // Pra reabrir o setup (modo restart): extrai o existente do params.simulator.
  const existingSetup =
    (params as NegotiationStrategyParams & { simulator?: NegotiationSimulatorSetup })
      .simulator ?? null;

  const transcriptAsMsgs: Msg[] = transcript.map((t) => ({
    role: t.role,
    content: t.content,
  }));

  function handleDownload() {
    window.location.href = `/api/assistants/runs/${runId}/docx`;
  }

  async function handleClose() {
    setMode('closing');
    try {
      const res = await fetch(`/api/assistants/runs/${runId}/close`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error('Falha ao encerrar', {
          description: data.error ?? `status ${res.status}`,
        });
        setMode('continuing');
        return;
      }
      const data = (await res.json()) as { score: NegotiationScore };
      setScore(data.score);
      setMode('view');
      setTab('score');
      toast.success('Score gerado.');
    } catch (err) {
      toast.error('Erro', { description: String(err) });
      setMode('continuing');
    }
  }

  async function handleRestart(setup: NegotiationSimulatorSetup) {
    setMode('setting-up');
    try {
      const res = await fetch(`/api/assistants/runs/${runId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setup),
      });
      if (!res.ok) {
        toast.error('Falha ao reiniciar simulação');
        setMode('view');
        return;
      }
      const data = (await res.json()) as { opener: string };
      // Reset local: novo opener vira o transcript inteiro.
      setTranscript([
        {
          role: 'assistant',
          content: data.opener,
          ts: new Date().toISOString(),
        },
      ]);
      setScore(null);
      setMode('continuing');
      setTab('simulation');
      toast.success('Simulação reiniciada.');
    } catch (err) {
      toast.error('Erro', { description: String(err) });
      setMode('view');
    }
  }

  // Loading screens for restart/close
  if (mode === 'setting-up' || mode === 'closing') {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-brand" aria-hidden="true" />
        <p className="text-sm">
          {mode === 'setting-up'
            ? 'Reiniciando simulação…'
            : 'Analisando sua negociação…'}
        </p>
      </div>
    );
  }

  // Setup view for restart mode
  if (mode === 'restarting') {
    return (
      <NegotiationSimulatorSetupView
        supplierName={params.supplierName}
        initial={existingSetup ?? undefined}
        onBack={() => setMode('view')}
        onStart={handleRestart}
        isLoading={false}
      />
    );
  }

  // Continuing mode: live chat with loaded transcript
  if (mode === 'continuing') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setMode('view')}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Voltar ao histórico
          </button>
          <span className="text-[10px] uppercase tracking-wider text-brand font-semibold">
            Continuando simulação · {transcript.length} turnos carregados
          </span>
        </div>
        <NegotiationChat
          runId={runId}
          params={params}
          strategy={strategy}
          initialMessages={transcriptAsMsgs}
          onViewStrategy={() => setTab('strategy')}
          onClose={handleClose}
          isClosing={false}
        />
      </div>
    );
  }

  // Default view mode: tabs
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/assistants/history"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Voltar ao histórico
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card hover:bg-accent h-9 px-4 text-xs font-medium text-foreground transition-all duration-300 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Baixar .docx
          </button>
          <Link
            href="/assistants/negotiation"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card hover:bg-accent h-9 px-4 text-xs font-medium text-foreground transition-all duration-300 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Nova estratégia
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        <TabButton
          active={tab === 'strategy'}
          onClick={() => setTab('strategy')}
          disabled={!strategy}
        >
          Estratégia
        </TabButton>
        <TabButton
          active={tab === 'simulation'}
          onClick={() => setTab('simulation')}
        >
          Simulação
          {transcript.length > 0 ? (
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              ({transcript.length})
            </span>
          ) : null}
        </TabButton>
        <TabButton
          active={tab === 'score'}
          onClick={() => setTab('score')}
          disabled={!score}
        >
          Score
          {score ? (
            <span className="ml-1.5 text-[10px] text-brand font-bold">
              {score.overall}/100
            </span>
          ) : null}
        </TabButton>
      </div>

      {tab === 'strategy' && strategy && (
        <NegotiationStrategyResultView
          params={params}
          result={strategy}
          onStartSimulation={() => {
            if (transcript.length > 0) {
              setMode('continuing');
            } else if (existingSetup) {
              setMode('restarting');
            } else {
              toast.info(
                'Esta estratégia não tem simulação configurada. Abra "Iniciar Simulação" no /assistants/negotiation.',
              );
            }
          }}
          onDownload={handleDownload}
        />
      )}

      {tab === 'simulation' && (
        <SimulationView
          transcript={transcript}
          supplierName={params.supplierName}
          hasSetup={!!existingSetup}
          onContinue={() => setMode('continuing')}
          onRestart={() => {
            if (
              transcript.length === 0 ||
              window.confirm(
                'Reiniciar a simulação? O histórico atual será apagado e uma nova abertura será gerada.',
              )
            ) {
              setMode('restarting');
            }
          }}
        />
      )}

      {tab === 'score' && score && (
        <NegotiationScoreView
          score={score}
          onDownload={handleDownload}
          onNewNegotiation={() => {
            window.location.href = '/assistants/negotiation';
          }}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`-mb-px inline-flex items-center px-4 h-9 text-sm font-medium border-b-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'border-brand text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function SimulationView({
  transcript,
  supplierName,
  hasSetup,
  onContinue,
  onRestart,
}: {
  transcript: NegotiationTranscriptTurn[];
  supplierName: string;
  hasSetup: boolean;
  onContinue: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap rounded-2xl border border-border bg-card p-3">
        <div className="text-xs text-muted-foreground">
          {transcript.length === 0
            ? hasSetup
              ? 'Ainda não há turnos. Inicie ou reinicie a simulação.'
              : 'Sem setup salvo. Inicie uma nova simulação no /assistants/negotiation.'
            : `${transcript.length} turnos salvos · você pode continuar de onde parou ou reiniciar.`}
        </div>
        <div className="flex gap-2">
          {transcript.length > 0 && (
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand text-black hover:bg-brand/90 h-9 px-4 text-xs font-semibold transition-all duration-300 active:scale-95"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Continuar simulação
            </button>
          )}
          {hasSetup && (
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card hover:bg-accent h-9 px-4 text-xs font-medium text-foreground transition-all duration-300 active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reiniciar simulação
            </button>
          )}
        </div>
      </div>

      {transcript.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Transcript · {transcript.length} turnos · {supplierName}
          </div>
          <div className="space-y-3">
            {transcript.map((t, i) => (
              <div
                key={i}
                className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                    t.role === 'user'
                      ? 'bg-brand text-black font-medium'
                      : 'bg-muted text-foreground/90'
                  }`}
                >
                  {t.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
                      <ReactMarkdown>{t.content}</ReactMarkdown>
                    </div>
                  ) : (
                    t.content
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
