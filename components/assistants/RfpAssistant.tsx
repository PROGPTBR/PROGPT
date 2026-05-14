'use client';

import { useState } from 'react';
import { RfpForm, type RfpFormValues } from './RfpForm';
import { RfpResult } from './RfpResult';
import { RfpChatPanel } from './RfpChatPanel';

// Top-level state machine for the RFP assistant page:
//   'form'        — user filling out parameters
//   'generating'  — streaming response from /api/assistants/rfp
//   'done'        — output complete + downloadable
// We hold the form values and the streamed markdown here; the child
// components are dumb.

type Phase = 'form' | 'generating' | 'done';

export function RfpAssistant() {
  const [phase, setPhase] = useState<Phase>('form');
  const [output, setOutput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [scope, setScope] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: RfpFormValues) {
    setPhase('generating');
    setOutput('');
    setRunId(null);
    setScope(values.scope);
    setError(null);

    try {
      const res = await fetch('/api/assistants/rfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: values.templateId,
          params: {
            client: values.client,
            scope: values.scope,
            category: values.category,
            deadline: values.deadline,
            budget: values.budget,
            criteria: values.criteria,
            notes: values.notes,
          },
        }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `status ${res.status}`);
      }

      // runId arrives via the response header (set by the API route). This
      // is observable immediately, before the stream is consumed.
      const runIdHeader = res.headers.get('x-run-id');
      if (runIdHeader) setRunId(runIdHeader);

      // The Vercel AI SDK streams "data stream protocol". We parse only
      // the text deltas (type code "0:") because this isn't a chat — it's a
      // one-shot generate. Other frames (annotations, finish events) are
      // ignored.
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
            // Tolerant: ignore malformed frames; stream continues.
          }
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assistente de RFP</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Preencha os parâmetros da contratação. O assistente gera um draft completo de RFP em
          markdown, pronto pra copiar ou baixar como .docx.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {phase === 'form' && <RfpForm onSubmit={handleSubmit} />}

      {(phase === 'generating' || phase === 'done') && (
        <RfpResult
          markdown={output}
          runId={runId}
          scope={scope}
          generating={phase === 'generating'}
          onReset={handleReset}
        />
      )}

      {phase === 'done' && runId && <RfpChatPanel runId={runId} />}
    </div>
  );
}
