'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  NegotiationScore,
  NegotiationSimulatorSetup,
  NegotiationStrategyParams,
  NegotiationStrategyResult,
} from '@/lib/assistants/types';
import { NegotiationStrategyForm } from './NegotiationStrategyForm';
import { NegotiationStrategyResult as NegotiationStrategyResultView } from './NegotiationStrategyResult';
import { NegotiationSimulatorSetupView } from './NegotiationSimulatorSetup';
import { NegotiationChat } from './NegotiationChat';
import { NegotiationScoreView } from './NegotiationScoreView';
import { handlePaywallResponse } from '@/lib/billing/handle-paywall';

// State machine do assistente de negociação.
// form → generating → strategy → setup → starting → chat → closing → score

type Phase =
  | { kind: 'form' }
  | { kind: 'generating-strategy'; params: NegotiationStrategyParams }
  | {
      kind: 'strategy';
      runId: string;
      params: NegotiationStrategyParams;
      strategy: NegotiationStrategyResult;
    }
  | {
      kind: 'setup';
      runId: string;
      params: NegotiationStrategyParams;
      strategy: NegotiationStrategyResult;
    }
  | {
      kind: 'starting';
      runId: string;
      params: NegotiationStrategyParams;
      strategy: NegotiationStrategyResult;
      setup: NegotiationSimulatorSetup;
    }
  | {
      kind: 'chat';
      runId: string;
      params: NegotiationStrategyParams;
      strategy: NegotiationStrategyResult;
      opener: string;
    }
  | {
      kind: 'closing';
      runId: string;
      params: NegotiationStrategyParams;
      strategy: NegotiationStrategyResult;
      opener: string;
    }
  | {
      kind: 'score';
      runId: string;
      params: NegotiationStrategyParams;
      strategy: NegotiationStrategyResult;
      score: NegotiationScore;
    };

export function NegotiationAssistant() {
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [overlayStrategy, setOverlayStrategy] = useState(false);

  async function handleStrategy(params: NegotiationStrategyParams) {
    setPhase({ kind: 'generating-strategy', params });
    try {
      const res = await fetch('/api/assistants/negotiation/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
      });
      if (handlePaywallResponse(res, 'negotiation')) {
        setPhase({ kind: 'form' });
        return;
      }
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as {
          retry_after_secs?: number;
        };
        toast.error(
          `Limite atingido. Tente em ${data.retry_after_secs ?? 60}s.`,
        );
        setPhase({ kind: 'form' });
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error('Falha ao gerar estratégia', {
          description: data.error ?? `status ${res.status}`,
        });
        setPhase({ kind: 'form' });
        return;
      }
      const data = (await res.json()) as {
        runId: string;
        strategy: NegotiationStrategyResult;
      };
      setPhase({
        kind: 'strategy',
        runId: data.runId,
        params,
        strategy: data.strategy,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro', { description: msg });
      setPhase({ kind: 'form' });
    }
  }

  async function handleStartSimulation() {
    if (phase.kind !== 'strategy') return;
    setPhase({
      kind: 'setup',
      runId: phase.runId,
      params: phase.params,
      strategy: phase.strategy,
    });
  }

  async function handleSetup(setup: NegotiationSimulatorSetup) {
    if (phase.kind !== 'setup') return;
    setPhase({
      kind: 'starting',
      runId: phase.runId,
      params: phase.params,
      strategy: phase.strategy,
      setup,
    });
    try {
      const res = await fetch(`/api/assistants/runs/${phase.runId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setup),
      });
      if (!res.ok) {
        toast.error('Falha ao iniciar simulação');
        setPhase({
          kind: 'setup',
          runId: phase.runId,
          params: phase.params,
          strategy: phase.strategy,
        });
        return;
      }
      const data = (await res.json()) as { opener: string };
      setPhase({
        kind: 'chat',
        runId: phase.runId,
        params: phase.params,
        strategy: phase.strategy,
        opener: data.opener,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro', { description: msg });
      setPhase({
        kind: 'setup',
        runId: phase.runId,
        params: phase.params,
        strategy: phase.strategy,
      });
    }
  }

  async function handleClose() {
    if (phase.kind !== 'chat') return;
    setPhase({ ...phase, kind: 'closing' });
    try {
      const res = await fetch(`/api/assistants/runs/${phase.runId}/close`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error('Falha ao encerrar', {
          description: data.error ?? `status ${res.status}`,
        });
        setPhase({ ...phase, kind: 'chat' });
        return;
      }
      const data = (await res.json()) as { score: NegotiationScore };
      setPhase({
        kind: 'score',
        runId: phase.runId,
        params: phase.params,
        strategy: phase.strategy,
        score: data.score,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro', { description: msg });
      setPhase({ ...phase, kind: 'chat' });
    }
  }

  function handleDownloadStrategy() {
    if (phase.kind === 'form' || phase.kind === 'generating-strategy') return;
    const runId =
      'runId' in phase
        ? (phase as { runId: string }).runId
        : null;
    if (!runId) return;
    window.location.href = `/api/assistants/runs/${runId}/docx`;
  }

  // Loading screens
  if (phase.kind === 'generating-strategy') {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-brand" aria-hidden="true" />
        <p className="text-sm">Gerando estratégia personalizada…</p>
        <p className="text-xs text-muted-foreground/70">Isso leva ~30-60 segundos.</p>
      </div>
    );
  }

  if (phase.kind === 'starting') {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-brand" aria-hidden="true" />
        <p className="text-sm">Preparando a simulação…</p>
      </div>
    );
  }

  if (phase.kind === 'closing') {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-brand" aria-hidden="true" />
        <p className="text-sm">Analisando sua negociação…</p>
      </div>
    );
  }

  if (phase.kind === 'form') {
    return (
      <NegotiationStrategyForm
        onSubmit={handleStrategy}
        isLoading={false}
      />
    );
  }

  if (phase.kind === 'strategy') {
    return (
      <NegotiationStrategyResultView
        params={phase.params}
        result={phase.strategy}
        onStartSimulation={handleStartSimulation}
        onDownload={handleDownloadStrategy}
      />
    );
  }

  if (phase.kind === 'setup') {
    return (
      <NegotiationSimulatorSetupView
        supplierName={phase.params.supplierName}
        onBack={() =>
          setPhase({
            kind: 'strategy',
            runId: phase.runId,
            params: phase.params,
            strategy: phase.strategy,
          })
        }
        onStart={handleSetup}
        isLoading={false}
      />
    );
  }

  if (phase.kind === 'chat') {
    return (
      <>
        <NegotiationChat
          runId={phase.runId}
          params={phase.params}
          strategy={phase.strategy}
          initialOpener={phase.opener}
          onViewStrategy={() => setOverlayStrategy(true)}
          onClose={handleClose}
          isClosing={false}
        />
        {overlayStrategy && (
          <StrategyOverlay
            params={phase.params}
            result={phase.strategy}
            onClose={() => setOverlayStrategy(false)}
          />
        )}
      </>
    );
  }

  // 'score'
  return (
    <NegotiationScoreView
      score={phase.score}
      onDownload={handleDownloadStrategy}
      onNewNegotiation={() => setPhase({ kind: 'form' })}
    />
  );
}

function StrategyOverlay({
  params,
  result,
  onClose,
}: {
  params: NegotiationStrategyParams;
  result: NegotiationStrategyResult;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <button
          type="button"
          onClick={onClose}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-card border border-border hover:bg-accent h-10 px-4 text-sm font-medium text-foreground transition-colors active:scale-95"
        >
          Fechar visualização
        </button>
        <NegotiationStrategyResultView
          params={params}
          result={result}
          onStartSimulation={onClose}
          onDownload={() => {}}
        />
      </div>
    </div>
  );
}
