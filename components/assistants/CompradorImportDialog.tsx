'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, FileText, Loader2, Upload, X, XCircle } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: (text: string) => void;
  /** Título do diálogo (propostas ou pedido de cotação). */
  titulo?: string;
};

// Lote de propostas (2026-10-08, cliente importando várias de uma vez): até
// 40 arquivos por envio, lidos de 3 em 3. Acima disso é quase certo que
// alguém selecionou uma pasta inteira sem querer.
export const MAX_FILES = 40;
const SIMULTANEOS = 3;

async function importOne(file: File): Promise<ImportOneResult> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/assistants/comprador/import', { method: 'POST', body: fd });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    throw new Error(data.detail ?? 'Não foi possível ler este arquivo.');
  }
  const data = (await res.json()) as { text?: string; filename?: string; truncated?: boolean };
  if (!data.text?.trim()) throw new Error('Não encontramos texto neste arquivo.');
  const filename = data.filename ?? file.name;
  // O nome do arquivo no topo ajuda a análise a separar uma proposta da outra.
  return { text: `### Documento: ${filename}\n${data.text.trim()}`, filename, truncated: !!data.truncated };
}

export type ImportOneResult = { text: string; filename: string; truncated: boolean };
export type ImportBatchResult = {
  ok: number;
  truncatedFilenames: string[];
  failed: { filename: string; message: string }[];
};

/**
 * Lê os arquivos (alguns ao mesmo tempo) e entrega o texto de cada um na
 * ordem em que foram escolhidos. Um arquivo com erro não interrompe os outros.
 * `importFn` é injetável para teste.
 */
export async function importAllFiles(
  files: File[],
  onImported: (text: string) => void,
  importFn: (file: File) => Promise<ImportOneResult> = importOne,
  onProgress?: (done: number, total: number) => void,
  onStatus?: (index: number, status: 'lendo' | 'ok' | 'erro', message?: string) => void,
): Promise<ImportBatchResult> {
  const resultados: ({ ok: true; r: ImportOneResult } | { ok: false; message: string } | undefined)[] = new Array(files.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < files.length) {
      const i = proximo++;
      onProgress?.(i, files.length);
      onStatus?.(i, 'lendo');
      try {
        const r = await importFn(files[i]!);
        resultados[i] = { ok: true, r };
        onStatus?.(i, 'ok');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        resultados[i] = { ok: false, message };
        onStatus?.(i, 'erro', message);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(SIMULTANEOS, files.length) }, trabalhador));

  let ok = 0;
  const truncatedFilenames: string[] = [];
  const failed: { filename: string; message: string }[] = [];
  resultados.forEach((res, i) => {
    if (res?.ok) {
      onImported(res.r.text);
      ok++;
      if (res.r.truncated) truncatedFilenames.push(res.r.filename);
    } else {
      failed.push({ filename: files[i]!.name, message: res?.message ?? 'Não foi possível ler este arquivo.' });
    }
  });
  return { ok, truncatedFilenames, failed };
}

type Linha = { nome: string; status: 'espera' | 'lendo' | 'ok' | 'erro'; message?: string };

export function CompradorImportDialog({ open, onClose, onImported, titulo = 'Importar documentos' }: Props) {
  const [lendo, setLendo] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      toast.error(`Envie no máximo ${MAX_FILES} arquivos por vez. Você escolheu ${files.length}.`);
      return;
    }
    setLendo(true);
    setLinhas(files.map((f) => ({ nome: f.name, status: 'espera' })));
    try {
      const { ok, truncatedFilenames, failed } = await importAllFiles(files, onImported, importOne, undefined, (i, status, message) =>
        setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, status, message } : l))),
      );
      if (ok > 0) toast.success(ok === 1 ? '1 documento lido e adicionado' : `${ok} documentos lidos e adicionados`);
      if (truncatedFilenames.length > 0) {
        toast.warning('Documento muito longo', {
          description: `Lemos o começo de ${truncatedFilenames.join(', ')}. Se faltar algo, divida o arquivo em partes.`,
        });
      }
      if (failed.length === 0) {
        setLinhas([]);
        onClose();
      }
    } finally {
      setLendo(false);
    }
  }

  function fechar() {
    if (lendo) return;
    setLinhas([]);
    onClose();
  }

  if (!open) return null;

  const feitos = linhas.filter((l) => l.status === 'ok' || l.status === 'erro').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl space-y-5 rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{titulo}</h3>
          <button
            type="button"
            onClick={fechar}
            disabled={lendo}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Arraste os arquivos para cá ou clique para escolher. Pode mandar vários de uma vez, até {MAX_FILES}: PDF, Word,
          Excel ou foto. Cada documento é lido e entra no campo, com o nome do arquivo no topo.
        </p>

        <div
          role="button"
          tabIndex={0}
          onClick={() => !lendo && inputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !lendo) inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            if (!lendo) void handleFiles(Array.from(e.dataTransfer.files));
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            arrastando ? 'border-brand bg-brand/10' : 'border-border bg-background hover:border-brand/50 hover:bg-accent'
          } ${lendo ? 'pointer-events-none opacity-70' : ''}`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient text-black">
            {lendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          </span>
          <span className="text-sm font-medium">
            {lendo ? `Lendo os documentos: ${feitos} de ${linhas.length}` : 'Arraste aqui ou clique para escolher os arquivos'}
          </span>
          <span className="text-xs text-muted-foreground">PDF até 25 MB · Word, Excel e fotos até 15 MB</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.docx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = '';
              void handleFiles(list);
            }}
          />
        </div>

        {linhas.length > 0 && (
          <ul className="max-h-60 space-y-1.5 overflow-y-auto rounded-2xl bg-background p-2">
            {linhas.map((l, i) => (
              <li key={`${l.nome}-${i}`} className="flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm">
                {l.status === 'ok' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : l.status === 'erro' ? (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                ) : l.status === 'lendo' ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand" />
                ) : (
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{l.nome}</span>
                  {l.status === 'erro' && <span className="block text-xs text-red-500">{l.message}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={fechar}
            disabled={lendo}
            className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {linhas.some((l) => l.status === 'erro') ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
