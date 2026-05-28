'use client';

import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { AbcForm, type AbcFormValues } from './AbcForm';
import { AbcResult } from './AbcResult';
import { RfpChatPanel } from './RfpChatPanel';
import { AssistantEntryChoice } from './AssistantEntryChoice';
import { handlePaywallResponse } from '@/lib/billing/handle-paywall';

// Sub-projeto 31 — Assistente de Análise ABC (Curva de Pareto).
//
// State machine mirrors RFP/Kraljic/Porter/Financial:
//   choice    — entry screen (download template OR start guided form)
//   form      — upload xlsx/csv + nome da análise + observações
//   generating — streaming response from /api/assistants/abc
//   done      — output complete + downloadable (.docx + .xlsx + chart)

type Phase = 'choice' | 'form' | 'generating' | 'done';

export function AbcAssistant() {
  const [phase, setPhase] = useState<Phase>('choice');
  const [output, setOutput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [analysisName, setAnalysisName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: AbcFormValues) {
    setPhase('generating');
    setOutput('');
    setRunId(null);
    setAnalysisName(values.analysisName);
    setError(null);

    try {
      const res = await fetch('/api/assistants/abc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: values.templateId,
          params: {
            analysisName: values.analysisName,
            analysisPeriod: values.analysisPeriod,
            notes: values.notes,
            consolidate: values.consolidate,
            items: values.items,
            ...(values.perfilId ? { perfilId: values.perfilId } : {}),
          },
        }),
      });
      if (handlePaywallResponse(res, 'abc')) {
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

      if (finalRunId) {
        try {
          const outRes = await fetch(`/api/assistants/runs/${finalRunId}/output`);
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
    setPhase('choice');
    setOutput('');
    setRunId(null);
    setError(null);
  }

  if (phase === 'choice') {
    return (
      <AssistantEntryChoice
        title="Assistente ABC"
        subtitle="Escolha como quer trabalhar: baixar o template do Procurement Garage para classificar offline, ou usar o formulário guiado e deixar o assistente classificar os itens + gerar relatório com curva de Pareto."
        templateHref="/templates/abc-template.xls"
        templateFilename="Exercicio-Curva-ABC.xls"
        templateFormat=".xls · planilha"
        templateDescription="Template Procurement Garage com colunas para nome, fornecedor, quantidade, preço unitário e cálculo automático de spend acumulado. Use offline para preencher e depois fazer upload aqui."
        assistedDescription="Faça upload da planilha de spend (XLSX, XLS ou CSV). O sistema classifica cada item nas classes A/B/C usando a lei de Pareto (80/95% cumulativo), gera relatório executivo, plano de ação por classe e gráfico da curva — pronto para .docx e .xlsx."
        AssistedIcon={BarChart3}
        onAssistedClick={() => setPhase('form')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Assistente ABC <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Análise ABC (Curva de Pareto) de spend. Suba sua planilha de pedidos ou
          itens com valor — o sistema ranqueia, classifica em A/B/C pelos cortes
          80/95% cumulativo e gera plano de ação por classe.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {phase === 'form' && <AbcForm onSubmit={handleSubmit} />}

      {(phase === 'generating' || phase === 'done') && (
        <AbcResult
          markdown={output}
          runId={runId}
          analysisName={analysisName}
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
