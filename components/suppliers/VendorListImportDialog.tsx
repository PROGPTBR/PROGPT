'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Upload, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NewSupplierInput } from '@/lib/suppliers/base';

// Import do "vendor list" do cliente (Batch L do backlog do diretor,
// Kraljic: "poderia subir o vendor list do cliente"). Mesmo padrão em 2
// passos do MaterialsImportDialog: parseia → mostra preview "N novos · N
// atualizados" (por CNPJ) → confirma.

type Props = {
  open: boolean;
  onClose: () => void;
  preview: (rows: NewSupplierInput[]) => { novos: number; atualizados: number };
  onConfirm: (rows: NewSupplierInput[]) => Promise<{ inserted: number; updated: number; failed: number }>;
};

type Parsed = { rows: NewSupplierInput[]; warnings: string[] };

export function VendorListImportDialog({ open, onClose, preview, onConfirm }: Props) {
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setParsed(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/suppliers/import', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `status ${res.status}`);
      }
      const data = (await res.json()) as Parsed;
      if (data.rows.length === 0) {
        toast.error('Nenhum fornecedor importado', {
          description: 'Confira se a planilha tem uma coluna de razão social/nome reconhecível.',
        });
        return;
      }
      setParsed(data);
    } catch (err) {
      toast.error('Falha ao importar', { description: String(err) });
    } finally {
      setUploading(false);
    }
  }

  async function confirmImport() {
    if (!parsed) return;
    setApplying(true);
    try {
      const { inserted, updated, failed } = await onConfirm(parsed.rows);
      if (failed > 0) {
        toast.warning(`${inserted} novo(s) · ${updated} atualizado(s) · ${failed} falharam`);
      } else {
        toast.success(`${inserted} novo(s) · ${updated} atualizado(s) gravado(s)`);
      }
      handleClose();
    } catch (err) {
      toast.error('Falha ao gravar a importação', { description: String(err) });
    } finally {
      setApplying(false);
    }
  }

  function handleClose() {
    setParsed(null);
    onClose();
  }

  if (!open) return null;

  const counts = parsed ? preview(parsed.rows) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Importar vendor list</h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading || applying}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!parsed ? (
          <>
            <p className="text-xs text-muted-foreground">
              Planilha .xlsx: colunas <strong>Razão social / nome</strong> (obrigatória), CNPJ,
              Categoria, UF, Município, Telefone, Email — os cabeçalhos são reconhecidos
              automaticamente. Fornecedores com o mesmo CNPJ já cadastrado são atualizados, não
              duplicados.
            </p>
            <label className="flex items-center justify-center gap-2 text-sm cursor-pointer rounded-md border border-dashed border-input bg-background px-4 py-6 hover:bg-accent disabled:opacity-50">
              <Upload className="h-4 w-4" />
              {uploading ? 'Lendo planilha…' : 'Selecionar .xlsx'}
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
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={uploading}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex items-center gap-1.5 text-foreground font-medium">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                {parsed.rows.length} linha(s) reconhecida(s)
              </div>
              <div className="text-muted-foreground">
                {counts!.novos} novo(s) · {counts!.atualizados} atualizado(s) (por CNPJ)
              </div>
            </div>
            {parsed.warnings.length > 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                {parsed.warnings.slice(0, 3).map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={applying}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={confirmImport} disabled={applying}>
                {applying ? 'Gravando…' : 'Confirmar importação'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
