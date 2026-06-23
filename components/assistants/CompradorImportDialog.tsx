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

// Mesmo padrão de modal dos outros assistentes (overlay fixo). Extrai texto de
// PDF/DOCX/XLSX/imagem via /api/assistants/comprador/import e entrega via onImported.
export function CompradorImportDialog({ open, onClose, onImported }: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/assistants/comprador/import', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
        throw new Error(data.detail ?? data.error ?? `status ${res.status}`);
      }
      const data = (await res.json()) as { text?: string; filename?: string; truncated?: boolean };
      if (!data.text?.trim()) {
        toast.error('Nada extraído do arquivo');
        return;
      }
      onImported(data.text);
      toast.success(`${data.filename ?? 'Arquivo'} importado${data.truncated ? ' (truncado)' : ''}`);
      onClose();
    } catch (err) {
      toast.error('Falha ao importar', { description: String(err) });
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Importar documento</h3>
          <button type="button" onClick={onClose} disabled={uploading} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          PDF, Excel (.xlsx), Word (.docx) ou imagem. O texto extraído é adicionado ao campo de propostas para você revisar.
        </p>
        <label className="flex items-center justify-center gap-2 text-sm cursor-pointer rounded-md border border-dashed border-input bg-background px-4 py-6 hover:bg-accent">
          <Upload className="h-4 w-4" />
          {uploading ? 'Extraindo…' : 'Selecionar arquivo'}
          <input
            type="file"
            accept=".pdf,.xlsx,.docx,image/png,image/jpeg,application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
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
