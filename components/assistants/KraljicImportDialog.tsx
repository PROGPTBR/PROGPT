'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ItemDraft } from './KraljicItemTable';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: (items: ItemDraft[]) => void;
};

type ServerItem = {
  name: string;
  segment?: string;
  category?: string;
  spendMM: number;
  criticality: number;
  technicalSpec: number;
  customerValue: number;
  marketStructure: number;
  marketRivalry: number;
  supplierPower: number;
  supplierSwitching: number;
};

function toDraft(it: ServerItem): ItemDraft {
  return {
    name: it.name,
    segment: it.segment ?? '',
    category: it.category ?? '',
    spendMM: String(it.spendMM ?? ''),
    criticality: it.criticality,
    technicalSpec: it.technicalSpec,
    customerValue: it.customerValue,
    marketStructure: it.marketStructure,
    marketRivalry: it.marketRivalry,
    supplierPower: it.supplierPower,
    supplierSwitching: it.supplierSwitching,
  };
}

export function KraljicImportDialog({ open, onClose, onImported }: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/assistants/kraljic/import-xlsx', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `status ${res.status}`);
      }
      const data = (await res.json()) as { items: ServerItem[]; warnings: string[] };
      if (data.warnings.length > 0) {
        toast.warning(`${data.warnings.length} aviso(s)`, {
          description: data.warnings.slice(0, 3).join(' · '),
        });
      }
      if (data.items.length === 0) {
        toast.error('Nenhum item importado', {
          description: 'Confira se a aba "DADOS" segue o template Procurement Garage ou tem cabeçalhos reconhecíveis.',
        });
      } else {
        onImported(data.items.map(toDraft));
        toast.success(`${data.items.length} item(ns) importado(s)`);
        onClose();
      }
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
          Aceita o template <strong>Procurement Garage</strong> direto (aba DADOS reconhecida automaticamente) ou qualquer .xlsx com cabeçalhos como &quot;Item&quot;, &quot;Spend&quot;, &quot;Criticidade&quot;, &quot;Estrutura&quot;, &quot;Rivalidade&quot;, etc.
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
