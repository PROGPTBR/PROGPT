'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, ImageIcon, Loader2, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ChartTypeOption = 'auto' | 'bar' | 'line' | 'pie';

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

const CHART_TYPE_LABEL: Record<ChartTypeOption, string> = {
  auto: 'Automático',
  bar: 'Barras',
  line: 'Linha',
  pie: 'Pizza',
};

const ERROR_LABEL: Record<string, string> = {
  no_data: 'Cole um dado ou anexe uma planilha.',
  file_too_large: 'Arquivo maior que 5 MB.',
  need_two_columns: 'Preciso de pelo menos 2 colunas (categoria e valor).',
  no_rows: 'Não consegui ler linhas de dado — confira o formato.',
  no_series: 'Não encontrei categoria + valor numérico válidos nessa tabela.',
  render_failed: 'Falha ao desenhar o gráfico.',
  invalid_form: 'Formulário inválido.',
};

const PLACEHOLDER = `Cole uma tabela — ex.:
Fornecedor\tGasto
ACME Ltda\t120000
Globex SA\t80500
Initech\t45200`;

export function GraficoRapido() {
  const [pasteText, setPasteText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [chartType, setChartType] = useState<ChartTypeOption>('auto');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickChartResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = (pasteText.trim().length > 0 || file !== null) && !loading;

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleGenerate() {
    if (!canSubmit) return;
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      if (file) form.set('file', file);
      else form.set('text', pasteText);
      if (chartType !== 'auto') form.set('chartType', chartType);
      if (title.trim()) form.set('title', title.trim());

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
      parsed.warnings.forEach((w) => toast.warning(w));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao gerar o gráfico.');
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Gráfico Rápido <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Cole uma tabela de dados (ou suba uma planilha CSV/XLSX) e receba um gráfico pronto
          para baixar e inserir em qualquer documento ou apresentação.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <Textarea
          value={pasteText}
          onChange={(e) => {
            setPasteText(e.target.value);
            if (e.target.value) clearFile();
          }}
          placeholder={PLACEHOLDER}
          rows={7}
          className="font-mono text-xs"
          disabled={loading}
        />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          ou
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            id="quick-chart-file"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f) setPasteText('');
            }}
            disabled={loading}
          />
          <label
            htmlFor="quick-chart-file"
            className="inline-flex items-center gap-1.5 text-sm rounded-md border border-border px-3 py-1.5 cursor-pointer hover:border-brand/50 hover:bg-brand/5 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            {file ? file.name : 'Anexar planilha (CSV/XLSX, até 5 MB)'}
          </label>
          {file && (
            <button
              type="button"
              onClick={clearFile}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              remover
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="quick-chart-type">
              Tipo de gráfico
            </label>
            <select
              id="quick-chart-type"
              value={chartType}
              onChange={(e) => setChartType(e.target.value as ChartTypeOption)}
              disabled={loading}
              className="block rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              {(Object.keys(CHART_TYPE_LABEL) as ChartTypeOption[]).map((k) => (
                <option key={k} value={k}>
                  {CHART_TYPE_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="quick-chart-title">
              Título (opcional)
            </label>
            <input
              id="quick-chart-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              placeholder="Ex.: Gasto por fornecedor — Q2"
              className="block w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
          <Button onClick={handleGenerate} disabled={!canSubmit}>
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Gerando…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Gerar gráfico
              </>
            )}
          </Button>
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm">
              <span className="font-medium text-foreground">{result.spec.title}</span>
              <span className="text-muted-foreground">
                {' '}
                — categoria: {result.spec.categoryColumn} · valor: {result.spec.valueColumn} ·{' '}
                {result.rowsUsed} linha(s)
              </span>
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
          {result.warnings.length > 0 && (
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!result && !loading && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <ImageIcon className="h-6 w-6 mx-auto mb-2 opacity-50" aria-hidden="true" />
          Nenhum gráfico gerado ainda.
        </div>
      )}
    </div>
  );
}
