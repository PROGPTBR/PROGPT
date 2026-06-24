'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Loader2,
  Receipt,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { handlePaywallResponse } from '@/lib/billing/handle-paywall';
import { SPEND_ANALYSIS_EXAMPLES } from '@/lib/assistants/examples';
import { SPEND_MAX_FILE_BYTES, SPEND_MAX_INVOICES } from '@/lib/assistants/types';

type Phase = 'form' | 'uploading' | 'processing' | 'done';
type Counts = {
  total: number;
  pending: number;
  extracting: number;
  done: number;
  needs_review: number;
  error: number;
};

const UPLOAD_CONCURRENCY = 4;
const isSheet = (f: File) => /\.(xlsx|xls|csv)$/i.test(f.name);
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

export function SpendAssistant() {
  const [phase, setPhase] = useState<Phase>('form');
  const [analysisName, setAnalysisName] = useState('');
  const [period, setPeriod] = useState('');
  const [referenceCurrency, setReferenceCurrency] = useState('BRL');
  const [notes, setNotes] = useState('');
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [sheet, setSheet] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [uploadDone, setUploadDone] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [report, setReport] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const newPdfs: File[] = [];
    let newSheet: File | null = null;
    const errs: string[] = [];
    for (const f of files) {
      if (isPdf(f)) {
        if (f.size > SPEND_MAX_FILE_BYTES) errs.push(`${f.name}: maior que 15 MB`);
        else newPdfs.push(f);
      } else if (isSheet(f)) {
        newSheet = f;
      } else {
        errs.push(`${f.name}: tipo não suportado`);
      }
    }
    if (errs.length) toast.error('Alguns arquivos foram ignorados', { description: errs.join(' · ') });
    if (newPdfs.length) {
      setPdfs((prev) => {
        const merged = [...prev, ...newPdfs];
        if (merged.length > SPEND_MAX_INVOICES) {
          toast.warning(`Limite de ${SPEND_MAX_INVOICES} notas por análise`, {
            description: `${merged.length - SPEND_MAX_INVOICES} PDF(s) acima do limite foram ignorados. Para lotes maiores, divida em mais de uma análise.`,
          });
        }
        return merged.slice(0, SPEND_MAX_INVOICES);
      });
    }
    if (newSheet) setSheet(newSheet);
  }

  function loadExample() {
    const ex = SPEND_ANALYSIS_EXAMPLES[0];
    if (!ex) return;
    setAnalysisName(ex.params.analysisName);
    setPeriod(ex.params.period ?? '');
    setReferenceCurrency(ex.params.referenceCurrency ?? 'BRL');
    setNotes(ex.params.notes ?? '');
    toast.info('Exemplo carregado — agora arraste suas invoices (PDF) ou uma planilha.');
  }

  const totalFiles = pdfs.length + (sheet ? 1 : 0);
  const canSubmit = analysisName.trim().length > 0 && totalFiles > 0;

  async function uploadPdf(runId: string, file: File): Promise<boolean> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/assistants/spend_analysis/${runId}/upload`, {
      method: 'POST',
      body: fd,
    });
    return res.ok;
  }

  const poll = useCallback((runId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/assistants/spend_analysis/${runId}/status`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { status: string; counts: Counts; error_message?: string };
        setCounts(data.counts);
        if (data.status === 'done') {
          if (pollRef.current) clearInterval(pollRef.current);
          const outRes = await fetch(`/api/assistants/runs/${runId}/output`);
          if (outRes.ok) {
            const o = (await outRes.json()) as { output_md: string };
            setReport(o.output_md);
          }
          setPhase('done');
        } else if (data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
          toast.error('A análise falhou', { description: data.error_message ?? 'tente novamente' });
          setPhase('form');
        }
      } catch {
        /* mantém o polling */
      }
    }, 2000);
  }, []);

  async function submit() {
    if (!canSubmit) return;
    setPhase('uploading');
    setUploadDone(0);
    setUploadTotal(totalFiles);

    // 1. cria o run (paywall aqui)
    let runId: string;
    try {
      const res = await fetch('/api/assistants/spend_analysis/create-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: { analysisName, period, referenceCurrency, fxMode: 'ptax', notes },
        }),
      });
      if (handlePaywallResponse(res, 'spend_analysis')) {
        setPhase('form');
        return;
      }
      if (res.status === 429) {
        toast.error('Muitas requisições — aguarde um instante.');
        setPhase('form');
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      runId = ((await res.json()) as { runId: string }).runId;
      runIdRef.current = runId;
    } catch (err) {
      toast.error('Não foi possível iniciar a análise', { description: String(err) });
      setPhase('form');
      return;
    }

    // 2. sobe os PDFs (concorrência limitada) + a planilha
    let ok = 0;
    let i = 0;
    async function worker() {
      while (i < pdfs.length) {
        const idx = i++;
        const success = await uploadPdf(runId, pdfs[idx]!);
        ok += success ? 1 : 0;
        setUploadDone((d) => d + 1);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, pdfs.length) }, worker),
    );
    if (sheet) {
      const fd = new FormData();
      fd.append('file', sheet);
      const sres = await fetch(`/api/assistants/spend_analysis/${runId}/sheet`, {
        method: 'POST',
        body: fd,
      });
      if (sres.ok) {
        const sj = (await sres.json()) as { inserted: number; warnings: string[] };
        ok += sj.inserted;
        if (sj.warnings?.length) toast.info('Planilha importada', { description: sj.warnings.join(' · ') });
      }
      setUploadDone((d) => d + 1);
    }

    if (ok === 0) {
      toast.error('Nenhuma nota válida foi enviada.');
      setPhase('form');
      return;
    }

    // 3. dispara o worker + começa o polling
    await fetch(`/api/assistants/spend_analysis/${runId}/run`, { method: 'POST' });
    setPhase('processing');
    poll(runId);
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase('form');
    setPdfs([]);
    setSheet(null);
    setCounts(null);
    setReport('');
    setUploadDone(0);
    setUploadTotal(0);
  }

  // ── Render ──
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/assistants" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Assistentes
        </Link>
      </div>

      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15 text-brand">
          <Receipt className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Análise de Gastos</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Suba um lote de invoices (PDF) ou uma planilha. Extraímos cada nota, classificamos
            por categoria, convertemos as moedas e entregamos os KPIs e o mapa de gastos.
          </p>
        </div>
      </div>

      {phase === 'form' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Nome da análise *</span>
              <input
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
                placeholder="Ex.: Gastos com fornecedores — 2025"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                maxLength={200}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Período (opcional)</span>
              <input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Ano fiscal 2025"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                maxLength={120}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Moeda de referência</span>
              <select
                value={referenceCurrency}
                onChange={(e) => setReferenceCurrency(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="BRL">BRL (Real)</option>
                <option value="USD">USD (Dólar)</option>
                <option value="EUR">EUR (Euro)</option>
              </select>
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Notas (opcional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Contexto da carteira, regras de país, etc."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                maxLength={2000}
              />
            </label>
          </div>

          {/* Banner de limite */}
          <div className="flex items-start gap-2 rounded-md border border-brand/30 bg-brand/[0.04] px-3 py-2 text-xs text-muted-foreground">
            <Receipt className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
            <span>
              <strong className="text-foreground">Limite por análise: até {SPEND_MAX_INVOICES} notas fiscais</strong>, 15 MB por PDF.
              Lotes grandes (centenas) podem levar vários minutos. Para mais de {SPEND_MAX_INVOICES} notas, divida em análises separadas.
            </span>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              dragOver ? 'border-brand bg-brand/5' : 'border-border'
            }`}
          >
            <Upload className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-2 text-sm">
              Arraste invoices em <strong>PDF</strong> (várias) e/ou uma <strong>planilha</strong> (XLSX/CSV)
            </p>
            <p className="text-xs text-muted-foreground">Até {SPEND_MAX_INVOICES} notas · 15 MB por PDF</p>
            <label className="mt-3 inline-block cursor-pointer text-sm font-medium text-brand">
              ou selecione arquivos
              <input
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </label>
          </div>

          {(pdfs.length > 0 || sheet) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Arquivos selecionados</span>
                <span
                  className={
                    pdfs.length >= SPEND_MAX_INVOICES
                      ? 'font-medium text-amber-600'
                      : 'text-muted-foreground'
                  }
                >
                  {pdfs.length} / {SPEND_MAX_INVOICES} notas (PDF){sheet ? ' + 1 planilha' : ''}
                </span>
              </div>
              {sheet && (
                <FileChip
                  icon={<FileSpreadsheet className="h-4 w-4 text-emerald-500" />}
                  name={sheet.name}
                  onRemove={() => setSheet(null)}
                />
              )}
              {pdfs.map((f, idx) => (
                <FileChip
                  key={`${f.name}-${idx}`}
                  icon={<FileText className="h-4 w-4 text-brand" />}
                  name={f.name}
                  onRemove={() => setPdfs((prev) => prev.filter((_, i) => i !== idx))}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={!canSubmit}>
              Analisar {totalFiles > 0 ? `${pdfs.length} PDF${sheet ? ' + planilha' : ''}` : ''}
            </Button>
            <Button variant="outline" onClick={loadExample}>
              <Sparkles className="mr-1 h-4 w-4" /> Carregar exemplo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Lotes grandes podem levar vários minutos — você pode fechar a aba e o processamento continua.
          </p>
        </div>
      )}

      {phase === 'uploading' && (
        <Status label={`Enviando arquivos… ${uploadDone}/${uploadTotal}`} />
      )}

      {phase === 'processing' && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-brand" /> Processando as notas…
          </div>
          {counts && (
            <>
              <Bar done={counts.done + counts.needs_review + counts.error} total={counts.total} />
              <div className="text-xs text-muted-foreground">
                {counts.done + counts.needs_review} de {counts.total} processadas
                {counts.needs_review > 0 && ` · ${counts.needs_review} p/ revisão`}
                {counts.error > 0 && ` · ${counts.error} com erro`}
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Extração → classificação → câmbio → consolidação. Pode levar alguns minutos.
          </p>
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium text-emerald-600">Análise concluída</span>
            <div className="flex items-center gap-2 flex-wrap">
              {runIdRef.current && (
                <>
                  <Link href={`/assistants/spend_analysis/${runIdRef.current}/dashboard`}>
                    <Button size="sm">
                      <LayoutDashboard className="mr-1 h-4 w-4" /> Abrir dashboard
                    </Button>
                  </Link>
                  <a href={`/api/assistants/runs/${runIdRef.current}/xlsx`}>
                    <Button variant="outline" size="sm">Excel</Button>
                  </a>
                  <a href={`/api/assistants/runs/${runIdRef.current}/docx`}>
                    <Button variant="outline" size="sm">Word</Button>
                  </a>
                </>
              )}
              <Button variant="outline" size="sm" onClick={reset}>
                Nova análise
              </Button>
            </div>
          </div>
          <article className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border bg-card p-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          </article>
        </div>
      )}
    </div>
  );
}

function FileChip({ icon, name, onRemove }: { icon: React.ReactNode; name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
      {icon}
      <span className="flex-1 truncate">{name}</span>
      <button onClick={onRemove} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Status({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-5 text-sm">
      <Loader2 className="h-4 w-4 animate-spin text-brand" /> {label}
    </div>
  );
}

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
