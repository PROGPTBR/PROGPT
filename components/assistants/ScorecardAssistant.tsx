'use client';

import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ScorecardForm, type ScorecardFormValues } from './ScorecardForm';
import { ScorecardResult } from './ScorecardResult';
import { RfpChatPanel } from './RfpChatPanel';
import { AssistantEntryChoice } from './AssistantEntryChoice';
import { handlePaywallResponse } from '@/lib/billing/handle-paywall';

type Phase = 'choice' | 'form' | 'generating' | 'done';

export function ScorecardAssistant() {
  const [phase, setPhase] = useState<Phase>('choice');
  const [output, setOutput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [scorecardName, setScorecardName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: ScorecardFormValues) {
    setPhase('generating');
    setOutput('');
    setRunId(null);
    setScorecardName(values.params.scorecardName);
    setError(null);

    try {
      const res = await fetch('/api/assistants/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: values.templateId,
          params: values.params,
        }),
      });
      if (handlePaywallResponse(res, 'scorecard')) {
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
          try {
            const text = JSON.parse(line.slice(colon + 1)) as string;
            setOutput((prev) => prev + text);
          } catch {
            // tolerant
          }
        }
      }

      // After stream end, fetch the full assembled markdown.
      if (finalRunId) {
        try {
          const outRes = await fetch(`/api/assistants/runs/${finalRunId}/output`);
          if (outRes.ok) {
            const data = (await outRes.json()) as { output_md?: string };
            if (data.output_md) setOutput(data.output_md);
          }
        } catch {
          // Non-fatal — user keeps the streamed head.
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
    setPhase('choice');
    setOutput('');
    setRunId(null);
    setError(null);
  }

  if (phase === 'choice') {
    return (
      <AssistantEntryChoice
        title="Supplier Scorecard"
        subtitle="Avalie e ranqueie fornecedores por critérios ponderados. Defina os critérios e pesos, insira as notas por fornecedor e o assistente gera ranking, faixas (Estratégico / Desenvolvimento / Saída) e plano de ação — pronto para .docx e .xlsx."
        templateHref="/templates/scorecard-template.xlsx"
        templateFilename="Scorecard-template.xlsx"
        templateFormat=".xlsx · planilha"
        templateDescription="Template com abas de critérios, fornecedores e notas. Preencha offline e importe aqui para gerar o relatório automaticamente."
        assistedDescription="Configure critérios com pesos, insira notas por fornecedor (0–10) e defina os thresholds de faixa. O sistema calcula o score ponderado, gera ranking + plano de ação por faixa e exporta .docx e .xlsx."
        AssistedIcon={BarChart3}
        onAssistedClick={() => setPhase('form')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Supplier Scorecard <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Configure critérios com pesos, insira notas por fornecedor (0–10) e defina os
          thresholds de faixa. O sistema calcula o score ponderado, gera ranking com faixas
          Estratégico / Desenvolvimento / Saída e plano de ação — pronto para .docx e .xlsx.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {phase === 'form' && <ScorecardForm onSubmit={handleSubmit} />}

      {(phase === 'generating' || phase === 'done') && (
        <ScorecardResult
          markdown={output}
          runId={runId}
          scorecardName={scorecardName}
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
