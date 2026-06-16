'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ScorecardResult } from './ScorecardResult';
import { RfpChatPanel } from './RfpChatPanel';

type Props = {
  runId: string;
  initialOutput: string;
  scorecardName: string;
};

export function PastScorecardView({ runId, initialOutput, scorecardName }: Props) {
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

      <ScorecardResult
        markdown={output}
        runId={runId}
        scorecardName={scorecardName}
        generating={false}
        onReset={() => {
          window.location.href = '/assistants/history';
        }}
      />

      <RfpChatPanel runId={runId} onRfpUpdated={(md) => setOutput(md)} />
    </div>
  );
}
