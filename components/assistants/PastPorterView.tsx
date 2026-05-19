'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PorterResult } from './PorterResult';
import { RfpChatPanel } from './RfpChatPanel';

// Sub-projeto 29 — Detail view for a past Porter run. Hydrates the
// 'done' state PorterAssistant would land on after a fresh generation:
// PorterResult on top + refinement chat below. Chat panel is stateless
// (in-memory) by design — refinement isn't persisted (sub-projeto 21).

type Props = {
  runId: string;
  initialOutput: string;
  categoria: string;
};

export function PastPorterView({ runId, initialOutput, categoria }: Props) {
  const [output, setOutput] = useState(initialOutput);

  return (
    <div className="space-y-6">
      <Link
        href="/assistants/history"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para Meu histórico
      </Link>

      <PorterResult
        markdown={output}
        runId={runId}
        categoria={categoria}
        generating={false}
        onReset={() => {
          window.location.href = '/assistants/history';
        }}
      />

      <RfpChatPanel runId={runId} onRfpUpdated={(md) => setOutput(md)} />
    </div>
  );
}
