'use client';

import { useState } from 'react';
import { PesquisaPrecosForm, type PesquisaPrecosFormValues } from './PesquisaPrecosForm';
import { PesquisaPrecosResult } from './PesquisaPrecosResult';
import { RfpChatPanel } from './RfpChatPanel';
import { handlePaywallResponse } from '@/lib/billing/handle-paywall';

type Phase = 'form' | 'generating' | 'done';

function buildParams(v: PesquisaPrecosFormValues) {
  return {
    titulo: v.titulo,
    ...(v.uf ? { uf: v.uf } : {}),
    itens: v.itens
      .filter((i) => i.descricao.trim().length >= 2)
      .map((i) => {
        const q = Number(i.quantidade.replace(/\./g, '').replace(/,/g, '.'));
        return {
          descricao: i.descricao.trim(),
          unidade: i.unidade.trim(),
          ...(Number.isFinite(q) && q > 0 ? { quantidade: q } : {}),
        };
      }),
    notas: v.notas,
  };
}

export function PesquisaPrecosAssistant() {
  const [phase, setPhase] = useState<Phase>('form');
  const [output, setOutput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: PesquisaPrecosFormValues) {
    setPhase('generating');
    setOutput('');
    setRunId(null);
    setTitulo(values.titulo);
    setError(null);

    try {
      const res = await fetch('/api/assistants/pesquisa_precos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: values.templateId,
          params: buildParams(values),
        }),
      });
      if (handlePaywallResponse(res, 'pesquisa_precos')) {
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
          if (line.slice(0, colon) !== '0') continue;
          try {
            setOutput((prev) => prev + (JSON.parse(line.slice(colon + 1)) as string));
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
          // non-fatal
        }
      }
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
          Pesquisa de Preços <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Descreva os itens que você precisa comprar e o assistente busca o preço
          de referência nas compras públicas (catálogo CATMAT / Painel de Preços),
          com mediana, faixa e fontes — pronto para ancorar RFP, estimativa de custo
          e negociação.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {phase === 'form' && <PesquisaPrecosForm onSubmit={handleSubmit} />}

      {(phase === 'generating' || phase === 'done') && (
        <PesquisaPrecosResult
          markdown={output}
          runId={runId}
          titulo={titulo}
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
