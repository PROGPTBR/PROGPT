'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { Download, RotateCcw, Copy, Search, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SendEmailButton } from './SendEmailButton';
import type { ItemSemAmostra } from './PesquisaPrecosAssistant';
import { PRICING_NCM_DISCLAIMER } from '@/lib/legal/disclaimers';
import type { PrecoAproximadoResult } from '@/lib/assistants/precos-aproximado';

type Props = {
  markdown: string;
  runId: string | null;
  titulo: string;
  generating: boolean;
  onReset: () => void;
  semAmostra?: ItemSemAmostra[];
};

export function PesquisaPrecosResult({
  markdown,
  runId,
  titulo,
  generating,
  onReset,
  semAmostra = [],
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
      a.download = `pesquisa-precos-${runId.slice(0, 8)}.docx`;
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
            Mapa de preços — {titulo.slice(0, 80)}
            {titulo.length > 80 ? '…' : ''}
          </div>
          {generating && (
            <div className="text-xs text-primary mt-0.5 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Consultando preços praticados e montando o mapa…
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onReset} disabled={generating}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Nova pesquisa
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
            subject={`Mapa de preços — ${titulo.slice(0, 60)}`}
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
            Mapeando os itens no catálogo CATMAT e consultando preços praticados…
            ~10-25 segundos.
          </p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        )}
        {generating && markdown.length > 0 && (
          <span className="inline-block w-2 h-4 bg-primary/50 align-middle animate-pulse ml-1" />
        )}
      </article>

      {!generating && semAmostra.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <div>
            <div className="text-sm font-medium">Itens sem amostra na base pública</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Estes itens não têm preços praticados recentes no CATMAT. Busque uma
              estimativa de mercado via IA (web) para preço e NCM aproximados.
            </p>
          </div>
          <div className="space-y-2">
            {semAmostra.map((item, idx) => (
              <ItemAproximadoRow key={`${item.descricao}-${idx}`} item={item} />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {PRICING_NCM_DISCLAIMER}
          </p>
        </div>
      )}
    </div>
  );
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ItemAproximadoRow({ item }: { item: ItemSemAmostra }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrecoAproximadoResult | null>(null);

  async function buscar() {
    setLoading(true);
    try {
      const res = await fetch('/api/assistants/pesquisa_precos/aproximado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: item.descricao, unidade: item.unidade }),
      });
      if (!res.ok) {
        toast.error(
          res.status === 429 ? 'Limite atingido. Tente em 1 min.' : 'Falha na busca aproximada',
        );
        return;
      }
      const data = (await res.json()) as PrecoAproximadoResult;
      setResult(data);
      if (!data.enabled) {
        toast.message('Busca aproximada não está ativa neste ambiente.');
      } else if (!data.available) {
        toast.message('Nenhuma estimativa confiável encontrada na busca web.');
      }
    } catch (err) {
      toast.error('Falha na busca aproximada', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-border/70 bg-background/40 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-foreground/90 line-clamp-1">
          {item.descricao}
          {item.unidade ? ` (${item.unidade})` : ''}
        </div>
        {!result?.available && (
          <Button size="sm" onClick={buscar} disabled={loading}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5 mr-1" />
            )}
            Buscar preço e NCM aproximado
          </Button>
        )}
      </div>

      {result?.available && (
        <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-3">
            {result.precoUnitario != null && (
              <span>
                <span className="text-muted-foreground">Preço aproximado:</span>{' '}
                <strong>R$ {formatBRL(result.precoUnitario)}</strong>
                {result.unidade ? ` / ${result.unidade}` : ''}
              </span>
            )}
            {result.ncm && (
              <span>
                <span className="text-muted-foreground">NCM:</span> {result.ncm}
                {result.ncmDescricao ? ` — ${result.ncmDescricao}` : ''}
              </span>
            )}
            <span className="rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 font-medium">
              referencial · indicativo, não-oficial
            </span>
          </div>
          {result.observacao && (
            <div className="text-muted-foreground">{result.observacao}</div>
          )}
          {result.fontes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.fontes.map((f) => (
                <a
                  key={f.url}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-brand transition-colors"
                >
                  <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                  {f.titulo}
                </a>
              ))}
            </div>
          )}
          <div className="text-muted-foreground">
            Consultado em {new Date(result.consultadoEm).toLocaleString('pt-BR')} · confiança{' '}
            {(result.confianca * 100).toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
}
