'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, MessageCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import type {
  NegotiationScore,
  NegotiationStrategyParams,
  NegotiationStrategyResult,
  NegotiationTranscriptTurn,
} from '@/lib/assistants/types';
import { NegotiationStrategyResult as NegotiationStrategyResultView } from './NegotiationStrategyResult';
import { NegotiationScoreView } from './NegotiationScoreView';

// Sub-projeto 22 (follow-up) — visualização de um run salvo de
// /assistants/negotiation. Renderiza:
//   - Strategy (cards visuais via NegotiationStrategyResult)
//   - Transcript (se houver) em formato chat read-only OU "retomar"
//   - Score (se houver) via NegotiationScoreView
//
// Server passa run.strategy/transcript/score já tipados; este componente
// é puramente apresentacional + permite retomar a simulação se o user
// quiser continuar (estado 'chat' do assistant principal).

type Props = {
  runId: string;
  params: NegotiationStrategyParams;
  strategy: NegotiationStrategyResult | null;
  transcript: NegotiationTranscriptTurn[] | null;
  score: NegotiationScore | null;
};

type Tab = 'strategy' | 'simulation' | 'score';

export function PastNegotiationView({
  runId,
  params,
  strategy,
  transcript,
  score,
}: Props) {
  const hasTranscript = (transcript?.length ?? 0) > 0;
  const hasScore = score !== null;
  const [tab, setTab] = useState<Tab>(
    hasScore ? 'score' : hasTranscript ? 'simulation' : 'strategy',
  );
  const [resuming, setResuming] = useState(false);

  function handleDownload() {
    window.location.href = `/api/assistants/runs/${runId}/docx`;
  }

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
            href={`/assistants/negotiation`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand text-black hover:bg-brand/90 h-9 px-4 text-xs font-semibold transition-all duration-300 active:scale-95"
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
          disabled={!hasTranscript}
        >
          Simulação
          {hasTranscript ? (
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              ({transcript!.length})
            </span>
          ) : null}
        </TabButton>
        <TabButton
          active={tab === 'score'}
          onClick={() => setTab('score')}
          disabled={!hasScore}
        >
          Score
          {hasScore ? (
            <span className="ml-1.5 text-[10px] text-brand font-bold">
              {score!.overall}/100
            </span>
          ) : null}
        </TabButton>
      </div>

      {tab === 'strategy' && strategy && (
        <NegotiationStrategyResultView
          params={params}
          result={strategy}
          onStartSimulation={async () => {
            // Permitir retomar uma simulação: se já tem transcript,
            // pula pra aba simulação; senão redireciona pro /negotiation
            // — o user precisa fazer setup novo se nunca configurou.
            if (hasTranscript) {
              setTab('simulation');
              return;
            }
            setResuming(true);
            toast.info('Para iniciar uma simulação dessa estratégia, abra novamente o assistente.', {
              description: 'O setup do simulador só roda em sessão nova.',
            });
            setResuming(false);
          }}
          onDownload={handleDownload}
          isDownloading={resuming}
        />
      )}

      {tab === 'simulation' && hasTranscript && (
        <TranscriptView transcript={transcript!} supplierName={params.supplierName} />
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

function TranscriptView({
  transcript,
  supplierName,
}: {
  transcript: NegotiationTranscriptTurn[];
  supplierName: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand">
        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Transcript · {transcript.length} turnos · Negociação com {supplierName}
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
  );
}
