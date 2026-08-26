'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Card do "Gráfico Rápido" dentro da PRÓPRIA bolha do chat — substitui o
// AssistantToolCTA genérico quando o tipo detectado é 'grafico_rapido'.
// Ao contrário do card genérico (que só linka pra /assistants/graficos),
// este gera o PNG ali mesmo a partir do texto que o usuário colou na
// mensagem anterior, reusando POST /api/tools/quick-chart (mesmo endpoint
// da ferramenta dedicada). Geração é sob clique (não automática no mount)
// pra não custar tokens de IA toda vez que a conversa é reaberta/rolada —
// mesmo espírito imperativo do MessageActions (fetch em resposta a evento,
// não em useEffect).

type QuickChartSpec = {
  chartType: 'bar' | 'line' | 'pie';
  categoryColumn: string;
  valueColumn: string;
  title: string;
};

type QuickChartResult = {
  pngBase64: string;
  spec: QuickChartSpec;
  warnings: string[];
  rowsUsed: number;
};

const ERROR_LABEL: Record<string, string> = {
  no_data: 'Não encontrei dado pra plotar nessa mensagem.',
  file_too_large: 'Arquivo maior que 5 MB.',
  need_two_columns: 'Preciso de pelo menos 2 colunas (categoria e valor) — cole a tabela completa.',
  no_rows: 'Não consegui ler uma tabela nessa mensagem — cole os dados em formato de tabela.',
  no_series: 'Não encontrei categoria + valor numérico válidos nessa mensagem.',
  render_failed: 'Falha ao desenhar o gráfico.',
  invalid_form: 'Formulário inválido.',
};

type State = 'idle' | 'loading' | 'done' | 'error';

type Props = { sourceText: string };

export function InlineQuickChart({ sourceText }: Props) {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<QuickChartResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setState('loading');
    setError(null);
    try {
      const form = new FormData();
      form.set('text', sourceText);
      const res = await fetch('/api/tools/quick-chart', { method: 'POST', body: form });

      if (res.status === 401) throw new Error('Sessão expirada — faça login novamente.');
      if (res.status === 429) {
        const body = await res.json().catch(() => null);
        throw new Error(`Muitas requisições — tente novamente em ${body?.retry_after_secs ?? 30}s.`);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(ERROR_LABEL[data?.error as string] ?? 'Falha ao gerar o gráfico.');
      }

      const parsed = data as QuickChartResult;
      setResult(parsed);
      setState('done');
      parsed.warnings.forEach((w) => toast.warning(w));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar o gráfico.');
      setState('error');
    }
  }

  function handleDownload() {
    if (!result) return;
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${result.pngBase64}`;
    a.download = `${(result.spec.title || 'grafico').replace(/[^\w-]+/g, '_').slice(0, 60)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (state === 'error') {
    return (
      <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={generate}>
            Tentar de novo
          </Button>
          <a href="/assistants/graficos" className="text-xs text-brand hover:underline">
            Abrir a ferramenta completa
          </a>
        </div>
      </div>
    );
  }

  if (state === 'done' && result) {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm">
            <span className="font-medium text-foreground">{result.spec.title}</span>
            <span className="text-muted-foreground"> — {result.rowsUsed} linha(s)</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Baixar PNG
          </Button>
        </div>
        <div className="rounded-md border border-border overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${result.pngBase64}`}
            alt={result.spec.title}
            className="w-full h-auto"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-4 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 to-brand/[0.04] px-4 py-4">
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
        <BarChart3 className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">
          Ferramenta dedicada
        </div>
        <div className="text-sm font-semibold text-foreground leading-tight">Gráfico Rápido</div>
        <div className="text-xs text-muted-foreground leading-snug">
          Gero o gráfico agora mesmo, aqui na conversa, a partir do que você colou.
        </div>
      </div>
      <Button size="sm" onClick={generate} disabled={state === 'loading'} className="flex-shrink-0">
        {state === 'loading' ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Gerando…
          </>
        ) : (
          'Gerar gráfico'
        )}
      </Button>
    </div>
  );
}
