'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: (text: string) => void;
};

// Máximo de arquivos por seleção — guarda de bom senso (não é um limite
// documentado do backend), evita alguém selecionar uma pasta inteira sem
// querer e disparar dezenas de chamadas sequenciais.
const MAX_FILES = 10;

async function importOne(file: File): Promise<{ text: string; filename: string; truncated: boolean }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/assistants/comprador/import', { method: 'POST', body: fd });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    throw new Error(data.detail ?? data.error ?? `status ${res.status}`);
  }
  const data = (await res.json()) as { text?: string; filename?: string; truncated?: boolean };
  if (!data.text?.trim()) throw new Error('Nada extraído do arquivo');
  return { text: data.text, filename: data.filename ?? file.name, truncated: !!data.truncated };
}

export type ImportOneResult = { text: string; filename: string; truncated: boolean };
export type ImportBatchResult = {
  ok: number;
  truncatedFilenames: string[];
  failed: { filename: string; message: string }[];
};

/**
 * Orquestração pura da importação em lote — extraída de `handleFiles` pra
 * poder testar sem jsdom/File mocks: continua nos demais arquivos quando um
 * falha, chama `onImported` (acumula no campo de propostas) uma vez por
 * arquivo bem-sucedido, na ordem original. `importFn` é injetável pra teste.
 */
export async function importAllFiles(
  files: File[],
  onImported: (text: string) => void,
  importFn: (file: File) => Promise<ImportOneResult> = importOne,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportBatchResult> {
  let ok = 0;
  const truncatedFilenames: string[] = [];
  const failed: { filename: string; message: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    const file = files[i]!;
    try {
      const { text, filename, truncated } = await importFn(file);
      onImported(text);
      ok++;
      if (truncated) truncatedFilenames.push(filename);
    } catch (err) {
      failed.push({ filename: file.name, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return { ok, truncatedFilenames, failed };
}

// Mesmo padrão de modal dos outros assistentes (overlay fixo). Extrai texto de
// PDF/DOCX/XLSX/imagem via /api/assistants/comprador/import e entrega via
// onImported — um por arquivo, na ordem selecionada, pra comparar várias
// propostas de uma vez (ex.: 3 PDFs de fornecedores diferentes). O caller
// (CompradorAssistant) já acumula cada chamada de onImported no campo de
// propostas, então múltiplos arquivos só precisam de múltiplas chamadas.
export function CompradorImportDialog({ open, onClose, onImported }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleFiles(files: File[]) {
    setUploading(true);
    try {
      const { ok, truncatedFilenames, failed } = await importAllFiles(
        files,
        onImported,
        importOne,
        (done, total) => setProgress({ done, total }),
      );
      if (ok > 0) {
        toast.success(
          files.length > 1 ? `${ok} de ${files.length} arquivo(s) importado(s)` : `${files[0]!.name} importado`,
        );
      }
      truncatedFilenames.forEach((filename) =>
        toast.warning(`${filename} importado, mas truncado (arquivo grande)`),
      );
      failed.forEach(({ filename, message }) =>
        toast.error('Falha ao importar', { description: `${filename}: ${message}` }),
      );
      if (ok > 0) onClose();
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  if (!open) return null;

  const label = uploading
    ? progress && progress.total > 1
      ? `Extraindo ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…`
      : 'Extraindo…'
    : 'Selecionar arquivos';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Importar documentos</h3>
          <button type="button" onClick={onClose} disabled={uploading} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          PDF, Excel (.xlsx), Word (.docx) ou imagem. Selecione um ou vários de uma vez (ex.: as
          propostas de 3 fornecedores diferentes) — o texto extraído de cada um é adicionado ao
          campo de propostas, pronto pra comparar.
        </p>
        <label className="flex items-center justify-center gap-2 text-sm cursor-pointer rounded-md border border-dashed border-input bg-background px-4 py-6 hover:bg-accent">
          <Upload className="h-4 w-4" />
          {label}
          <input
            type="file"
            multiple
            accept=".pdf,.xlsx,.docx,image/png,image/jpeg,application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (list.length === 0) return;
              if (list.length > MAX_FILES) {
                toast.error(`Selecione no máximo ${MAX_FILES} arquivos por vez`);
                return;
              }
              void handleFiles(list);
            }}
          />
        </label>
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={uploading}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
