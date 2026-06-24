'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, FileDown, FileText, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RfpChatPanel } from './RfpChatPanel';

type Props = {
  runId: string;
  initialOutput: string;
  analysisName: string;
};

export function PastSpendView({ runId, initialOutput, analysisName }: Props) {
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

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{analysisName}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/assistants/spend_analysis/${runId}/dashboard`}>
            <Button size="sm">
              <LayoutDashboard className="mr-1 h-4 w-4" /> Dashboard
            </Button>
          </Link>
          <a href={`/api/assistants/runs/${runId}/xlsx`}>
            <Button variant="outline" size="sm">
              <FileDown className="mr-1 h-4 w-4" /> Excel
            </Button>
          </a>
          <a href={`/api/assistants/runs/${runId}/docx`}>
            <Button variant="outline" size="sm">
              <FileText className="mr-1 h-4 w-4" /> Word
            </Button>
          </a>
        </div>
      </div>

      <article className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border bg-card p-5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
      </article>

      <RfpChatPanel runId={runId} onRfpUpdated={(md) => setOutput(md)} />
    </div>
  );
}
