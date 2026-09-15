'use client';

import { useState } from 'react';
import {
  DiagnosticoAquisicaoForm,
  type DiagnosticoAquisicaoFormValues,
} from './DiagnosticoAquisicaoForm';
import { DiagnosticoAquisicaoResult } from './DiagnosticoAquisicaoResult';
import { handlePaywallResponse } from '@/lib/billing/handle-paywall';
import { readAssistantChunk } from '@/lib/assistants/stream-client';

// Diagnóstico de Aquisição — form → generating → done. Mesma state machine
// dos outros assistentes de uma etapa só (ver ProfileAssistant.tsx).

type Phase = 'form' | 'generating' | 'done';

export function DiagnosticoAquisicaoAssistant() {
  const [phase, setPhase] = useState<Phase>('form');
  const [output, setOutput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [descricaoCompra, setDescricaoCompra] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: DiagnosticoAquisicaoFormValues) {
    setPhase('generating');
    setOutput('');
    setRunId(null);
    setDescricaoCompra(values.descricaoCompra);
    setError(null);

    try {
      const { templateId, ...params } = values;
      const res = await fetch('/api/assistants/diagnostico_aquisicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, params }),
      });
      if (handlePaywallResponse(res, 'diagnostico_aquisicao')) {
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
        const { value, done } = await readAssistantChunk(reader);
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
          try {
            const text = JSON.parse(line.slice(colon + 1)) as string;
            setOutput((prev) => prev + text);
          } catch {
            // tolerant
          }
        }
      }

      if (finalRunId) {
        try {
          const outRes = await fetch(`/api/assistants/runs/${finalRunId}/output`);
          if (outRes.ok) {
            const data = (await outRes.json()) as { output_md?: string };
            if (data.output_md) setOutput(data.output_md);
          }
        } catch {
          // Non-fatal.
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Diagnóstico de Aquisição <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Classifique a compra como CAPEX ou OPEX, informe criticidade, complexidade de mercado e
          impacto operacional — o assistente recomenda os KPIs certos e a estratégia (SOURCE,
          CONTRACT ou BUY) para conduzir a aquisição.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {phase === 'form' && <DiagnosticoAquisicaoForm onSubmit={handleSubmit} />}

      {(phase === 'generating' || phase === 'done') && (
        <DiagnosticoAquisicaoResult
          markdown={output}
          runId={runId}
          descricaoCompra={descricaoCompra}
          generating={phase === 'generating'}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
