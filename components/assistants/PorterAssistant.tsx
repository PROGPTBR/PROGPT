'use client';

import { useState } from 'react';
import { PorterForm, type PorterFormValues } from './PorterForm';
import { PorterResult } from './PorterResult';
import { RfpChatPanel } from './RfpChatPanel';
import { DownloadTemplateButton } from './DownloadTemplateButton';
import { handlePaywallResponse } from '@/lib/billing/handle-paywall';

// Sub-projeto 29 — Assistente das 5 Forças de Porter.
//
// State machine mirrors RFP/Kraljic:
//   form      — user filling out categoria/segmento/etc (entrada direta)
//   generating — streaming response from /api/assistants/porter
//   done      — output complete + downloadable
//
// On 'done' we also mount RfpChatPanel (assistant-type-agnostic chat)
// so the user can refine the analysis — refine.ts dispatches by
// assistant_type and routes to buildPorterRefineSystem.

type Phase = 'form' | 'generating' | 'done';

export function PorterAssistant() {
  const [phase, setPhase] = useState<Phase>('form');
  const [output, setOutput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: PorterFormValues) {
    setPhase('generating');
    setOutput('');
    setRunId(null);
    setCategoria(values.categoria);
    setError(null);

    try {
      const res = await fetch('/api/assistants/porter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: values.templateId,
          params: {
            categoria: values.categoria,
            segmento: values.segmento,
            escopo: values.escopo,
            observacoes: values.observacoes,
            statements: values.statements,
            ...(values.perfilId ? { perfilId: values.perfilId } : {}),
          },
        }),
      });
      if (handlePaywallResponse(res, 'porter')) {
        setPhase('form');
        return;
      }
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `status ${res.status}`);
      }

      const runIdHeader = res.headers.get('x-run-id');
      if (runIdHeader) setRunId(runIdHeader);
      const finalRunId = runIdHeader;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line) continue;
          const colon = line.indexOf(':');
          if (colon < 0) continue;
          const type = line.slice(0, colon);
          if (type !== '0') continue;
          const json = line.slice(colon + 1);
          try {
            const text = JSON.parse(json) as string;
            setOutput((prev) => prev + text);
          } catch {
            // Tolerant: ignore malformed frames.
          }
        }
      }
      // Fetch the full assembled document (LLM head + any verbatim
      // tail from the template). Mirrors RFP/Kraljic pattern.
      if (finalRunId) {
        try {
          const outRes = await fetch(
            `/api/assistants/runs/${finalRunId}/output`,
          );
          if (outRes.ok) {
            const data = (await outRes.json()) as { output_md?: string };
            if (data.output_md) setOutput(data.output_md);
          }
        } catch {
          // Non-fatal — streamed head still on screen.
        }
      }
      setPhase('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPhase('form');
    }
  }

  function handleReset() {
    setPhase('form');
    setOutput('');
    setRunId(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Assistente Porter <span className="text-brand">.</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Análise das 5 Forças de Porter (1979) para uma categoria. Classifica
            a intensidade de cada força (baixa/média/alta) com drivers concretos
            e traduz para implicações práticas no sourcing.
          </p>
        </div>
        {phase === 'form' && (
          <DownloadTemplateButton
            href="/templates/porter-template.md"
            filename="Porter-5-forcas-referencia.md"
            format=".md"
            description="Framework canônico das 5 Forças de Porter (1979) com drivers por força e checklist de classificação. Use offline como roteiro de análise manual."
          />
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {phase === 'form' && <PorterForm onSubmit={handleSubmit} />}

      {(phase === 'generating' || phase === 'done') && (
        <PorterResult
          markdown={output}
          runId={runId}
          categoria={categoria}
          generating={phase === 'generating'}
          onReset={handleReset}
        />
      )}

      {phase === 'done' && runId && (
        <RfpChatPanel runId={runId} onRfpUpdated={(md) => setOutput(md)} />
      )}
    </div>
  );
}
