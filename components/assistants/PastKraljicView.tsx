'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { KraljicResult } from './KraljicResult';
import { RfpChatPanel } from './RfpChatPanel';

// Sub-projeto 27 — Detail view para uma análise Kraljic passada.
// Mesma forma do PastRfpView mas com KraljicResult.

type Props = {
  runId: string;
  initialOutput: string;
  portfolioName: string;
};

export function PastKraljicView({ runId, initialOutput, portfolioName }: Props) {
  const [output, setOutput] = useState(initialOutput);

  return (
    <div className="space-y-6">
      <Link
        href="/assistants/history"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para minhas análises
      </Link>

      <KraljicResult
        markdown={output}
        runId={runId}
        portfolioName={portfolioName}
        generating={false}
        onReset={() => {
          window.location.href = '/assistants/history';
        }}
      />

      <RfpChatPanel runId={runId} onRfpUpdated={(md) => setOutput(md)} />
    </div>
  );
}
