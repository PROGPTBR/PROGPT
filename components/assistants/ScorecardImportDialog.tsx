'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ScorecardCriterion, ScorecardSupplier } from '@/lib/assistants/types';

type ImportedData = {
  criteria: ScorecardCriterion[];
  suppliers: ScorecardSupplier[];
  warnings: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: (data: ImportedData) => void;
};

export function ScorecardImportDialog({ open, onClose, onImported }: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/assistants/scorecard/import', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `status ${res.status}`);
      }
      const data = (await res.json()) as ImportedData;
      if (data.criteria.length === 0) {
        toast.error('Nenhum critério importado', {
          description:
            'Confira se a planilha tem colunas de critérios e fornecedores reconhecíveis.',
        });
        return;
      }
      onImported(data);
      toast.success(
        `${data.criteria.length} critério(s) · ${data.suppliers.length} fornecedor(es) importado(s)`,
      );
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
          <h3 className="text-base font-semibold">Importar planilha</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Aceita planilhas .xlsx com colunas de critérios (id, label, weight) e fornecedores
          (name, segment, scores). Baixe o template em{' '}
          <strong>/templates/scorecard-template.xlsx</strong> para o formato esperado.
        </p>

        <label className="flex items-center justify-center gap-2 text-sm cursor-pointer rounded-md border border-dashed border-input bg-background px-4 py-6 hover:bg-accent disabled:opacity-50">
          <Upload className="h-4 w-4" />
          {uploading ? 'Importando…' : 'Selecionar .xlsx'}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
