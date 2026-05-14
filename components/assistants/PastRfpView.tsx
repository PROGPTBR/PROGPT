'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { RfpResult } from './RfpResult';
import { RfpChatPanel } from './RfpChatPanel';

// Sub-projeto 26 — Detail view for a past assistant run.
//
// Hydrates the same "done" state RfpAssistant would land on after a
// fresh generation: RfpResult on top + the refinement chat panel
// below. The chat panel is stateless (in-memory) so reopening the
// run reset the conversation — that matches its original sub-projeto
// 21 design (refinement isn't persisted by intent).

type Props = {
  runId: string;
  initialOutput: string;
  scope: string;
};

export function PastRfpView({ runId, initialOutput, scope }: Props) {
  const [output, setOutput] = useState(initialOutput);

  return (
    <div className="space-y-6">
      <Link
        href="/assistants/history"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para Meus RFPs
      </Link>

      <RfpResult
        markdown={output}
        runId={runId}
        scope={scope}
        generating={false}
        onReset={() => {
          // No reset on past runs — back-to-history serves as the exit.
          window.location.href = '/assistants/history';
        }}
      />

      <RfpChatPanel
        runId={runId}
        onRfpUpdated={(md) => setOutput(md)}
      />
    </div>
  );
}
