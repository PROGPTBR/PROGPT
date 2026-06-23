'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { Download, RotateCcw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SendEmailButton } from './SendEmailButton';

type Props = {
  markdown: string;
  runId: string | null;
  supplierLabel: string;
  generating: boolean;
  onReset: () => void;
};

export function HomologacaoResult({
  markdown,
  runId,
  supplierLabel,
  generating,
  onReset,
}: Props) {
  const [downloadingDocx, setDownloadingDocx] = useState(false);

  async function handleDownloadDocx() {
    if (!runId) return;
    setDownloadingDocx(true);
    try {
      const res = await fetch(`/api/assistants/runs/${runId}/docx`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homologacao-${runId.slice(0, 8)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Falha ao baixar .docx', { description: String(err) });
    } finally {
      setDownloadingDocx(false);
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm">
          <div className="text-muted-foreground">
            Homologação — {supplierLabel.slice(0, 80)}
            {supplierLabel.length > 80 ? '…' : ''}
          </div>
          {generating && (
            <div className="text-xs text-primary mt-0.5 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Consultando dados fiscais e gerando relatório…
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onReset} disabled={generating}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Nova homologação
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
          <SendEmailButton
            subject={`Homologação — ${supplierLabel.slice(0, 60)}`}
            body={markdown}
            disabled={generating}
          />
          <Button
            size="sm"
            onClick={handleDownloadDocx}
            disabled={generating || !runId || downloadingDocx}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            {downloadingDocx ? 'Baixando…' : 'Baixar .docx'}
          </Button>
        </div>
      </div>

      <article className="rounded-md border border-border bg-card p-6 prose prose-sm dark:prose-invert max-w-none overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap [&_table]:max-w-full [&_th]:px-2 [&_td]:px-2">
        {markdown.length === 0 && generating ? (
          <p className="text-muted-foreground italic">
            Consultando situação cadastral, score de risco e compliance na
            Receita… ~10-20 segundos.
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
