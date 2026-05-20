'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProfileResult } from './ProfileResult';
import { RfpChatPanel } from './RfpChatPanel';

type Props = {
  runId: string;
  initialOutput: string;
  nomeCategoria: string;
};

export function PastProfileView({ runId, initialOutput, nomeCategoria }: Props) {
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

      <ProfileResult
        markdown={output}
        runId={runId}
        nomeCategoria={nomeCategoria}
        generating={false}
        onReset={() => {
          window.location.href = '/assistants/history';
        }}
      />

      <RfpChatPanel runId={runId} onRfpUpdated={(md) => setOutput(md)} />
    </div>
  );
}
