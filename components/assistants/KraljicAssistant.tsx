'use client';

import { useState } from 'react';
import { KraljicForm, type KraljicFormValues } from './KraljicForm';
import { KraljicResult } from './KraljicResult';
import { RfpChatPanel } from './RfpChatPanel';

type Phase = 'form' | 'generating' | 'done';

// Sub-projeto 27 — same shape as RfpAssistant: form → generating → done.
// On done we also mount RfpChatPanel (assistant-type-agnostic chat) so
// the user can refine the narrative — and "Aplicar à análise" patches
// the head via the shared /api/assistants/runs/[id]/apply endpoint.

export function KraljicAssistant() {
  const [phase, setPhase] = useState<Phase>('form');
  const [output, setOutput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [portfolioName, setPortfolioName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: KraljicFormValues) {
    setPhase('generating');
    setOutput('');
    setRunId(null);
    setPortfolioName(values.portfolioName);
    setError(null);

    try {
      const items = values.items.map((it) => ({
        name: it.name,
        segment: it.segment,
        category: it.category,
        spendMM: Number(String(it.spendMM).replace(',', '.')) || 0,
        criticality: it.criticality,
        technicalSpec: it.technicalSpec,
        customerValue: it.customerValue,
        marketStructure: it.marketStructure,
        marketRivalry: it.marketRivalry,
        supplierPower: it.supplierPower,
        supplierSwitching: it.supplierSwitching,
      }));

      const res = await fetch('/api/assistants/kraljic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: values.templateId,
          params: {
            portfolioName: values.portfolioName,
            analysisPeriod: values.analysisPeriod,
            notes: values.notes,
            items,
          },
        }),
      });
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
          try {
            const text = JSON.parse(line.slice(colon + 1)) as string;
            setOutput((prev) => prev + text);
          } catch {
            // tolerant
          }
        }
      }

      // After stream end, fetch the full assembled markdown (head + tail
      // including the verbatim closing legal text appended by the server).
      if (finalRunId) {
        try {
          const outRes = await fetch(`/api/assistants/runs/${finalRunId}/output`);
          if (outRes.ok) {
            const data = (await outRes.json()) as { output_md?: string };
            if (data.output_md) setOutput(data.output_md);
          }
        } catch {
          // Non-fatal — user keeps the streamed head; downloads still
          // render the full document from DB.
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
        <h1 className="text-2xl font-semibold tracking-tight">Assistente Kraljic</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Liste suas categorias com spend + 7 sub-scores. O sistema classifica cada item na
          Matriz de Kraljic e gera relatório executivo, plano de ação por quadrante e gráfico
          bubble 2×2 — pronto para .docx e .xlsx.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {phase === 'form' && <KraljicForm onSubmit={handleSubmit} />}

      {(phase === 'generating' || phase === 'done') && (
        <KraljicResult
          markdown={output}
          runId={runId}
          portfolioName={portfolioName}
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
