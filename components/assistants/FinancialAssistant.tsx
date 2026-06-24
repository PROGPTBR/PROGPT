'use client';

import { useState } from 'react';
import { FinancialForm, type FinancialFormValues } from './FinancialForm';
import { FinancialResult } from './FinancialResult';
import { RfpChatPanel } from './RfpChatPanel';
import { DownloadTemplateButton } from './DownloadTemplateButton';
import { handlePaywallResponse } from '@/lib/billing/handle-paywall';

type Phase = 'form' | 'generating' | 'done';

export function FinancialAssistant() {
  const [phase, setPhase] = useState<Phase>('form');
  const [output, setOutput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: FinancialFormValues) {
    setPhase('generating');
    setOutput('');
    setRunId(null);
    setSupplierName(values.supplierName);
    setError(null);

    try {
      const res = await fetch('/api/assistants/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: values.templateId,
          params: {
            supplierName: values.supplierName,
            cnpj: values.cnpj,
            referenceYear: values.referenceYear,
            observacoes: values.observacoes,
            indicators: values.indicators,
            ...(values.perfilId ? { perfilId: values.perfilId } : {}),
          },
        }),
      });
      if (handlePaywallResponse(res, 'financial')) {
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
            // Tolerant.
          }
        }
      }
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Análise Financeira <span className="text-brand">.</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Score 0-100 calculado a partir dos 4 pilares ponderados (Liquidez,
            Dívida/EBITDA, Margem EBITDA, ROE). LLM gera relatório bancário
            com recomendação de compra, risco de falência e termos de pagamento.
          </p>
        </div>
        {phase === 'form' && (
          <DownloadTemplateButton
            href="/templates/financial-template.md"
            filename="Financial-Health-Analyzer-referencia.md"
            format=".md"
            description="Guia com a fórmula de score (4 pilares: Liquidez 30%, Dívida/EBITDA 30%, Margem EBITDA 20%, ROE 20%) e os 12 indicadores. Use offline como checklist de due diligence."
          />
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {phase === 'form' && <FinancialForm onSubmit={handleSubmit} />}

      {(phase === 'generating' || phase === 'done') && (
        <FinancialResult
          markdown={output}
          runId={runId}
          supplierName={supplierName}
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
