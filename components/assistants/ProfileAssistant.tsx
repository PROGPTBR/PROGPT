'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { ProfileForm, type ProfileFormValues } from './ProfileForm';
import { ProfileResult } from './ProfileResult';
import { RfpChatPanel } from './RfpChatPanel';
import { AssistantEntryChoice } from './AssistantEntryChoice';

// Sub-projeto 33 — Profile (Perfil da Categoria) assistant.
//
// State machine mirrors the other 5 assistants:
//   choice → form → generating → done

type Phase = 'choice' | 'form' | 'generating' | 'done';

export function ProfileAssistant() {
  const [phase, setPhase] = useState<Phase>('choice');
  const [output, setOutput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: ProfileFormValues) {
    setPhase('generating');
    setOutput('');
    setRunId(null);
    setNomeCategoria(values.nomeCategoria);
    setError(null);

    try {
      const { templateId, ...params } = values;
      const res = await fetch('/api/assistants/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, params }),
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
    setPhase('choice');
    setOutput('');
    setRunId(null);
    setError(null);
  }

  if (phase === 'choice') {
    return (
      <AssistantEntryChoice
        title="Assistente Perfil"
        subtitle="Caracterize uma categoria de compra antes de partir para análise de spend, mercado ou sourcing. Escolha como quer trabalhar."
        templateHref="/templates/profile-template.md"
        templateFilename="Perfil-Categoria-referencia.md"
        templateFormat=".md · referência"
        templateDescription="Roteiro de Perfil da Categoria baseado em Monczka + O'Brien — 15 campos em 5 blocos. Use offline como guia para preencher o form ou para preparar a entrevista com stakeholders."
        assistedDescription="Preencha o form guiado (15 campos) ou faça upload de um Perfil em PDF/DOCX que você já tenha — o sistema extrai os campos automaticamente. O assistente gera o documento estruturado com persona sênior, fundamentado na base de conhecimento."
        AssistedIcon={FileText}
        onAssistedClick={() => setPhase('form')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Assistente Perfil <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Perfil da Categoria (Strategic Sourcing Step 1) — caracterização
          estruturada que alimenta os próximos passos (ABC, Kraljic, Porter, RFP).
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {phase === 'form' && <ProfileForm onSubmit={handleSubmit} />}

      {(phase === 'generating' || phase === 'done') && (
        <ProfileResult
          markdown={output}
          runId={runId}
          nomeCategoria={nomeCategoria}
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
