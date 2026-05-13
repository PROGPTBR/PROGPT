'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { Download, RotateCcw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  markdown: string;
  runId: string | null;
  scope: string;
  generating: boolean;
  onReset: () => void;
};

export function RfpResult({ markdown, runId, scope, generating, onReset }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!runId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/assistants/runs/${runId}/docx`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rfp-${runId.slice(0, 8)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Falha ao baixar .docx', { description: String(err) });
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success('Markdown copiado');
    } catch {
      toast.error('Falha ao copiar');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <div className="text-muted-foreground">RFP — {scope.slice(0, 80)}{scope.length > 80 ? '…' : ''}</div>
          {generating && (
            <div className="text-xs text-primary mt-0.5 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Gerando…
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReset} disabled={generating}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Novo RFP
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={generating || markdown.length === 0}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copiar
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={generating || !runId || downloading}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            {downloading ? 'Baixando…' : 'Baixar .docx'}
          </Button>
        </div>
      </div>

      <article className="rounded-md border border-border bg-card p-6 prose prose-sm dark:prose-invert max-w-none">
        {markdown.length === 0 && generating ? (
          <p className="text-muted-foreground italic">
            Iniciando geração… isso costuma levar 30-60 segundos pra um RFP completo.
          </p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        )}
        {generating && markdown.length > 0 && (
          <span className="inline-block w-2 h-4 bg-primary/50 align-middle animate-pulse ml-1" />
        )}
      </article>
    </div>
  );
}
