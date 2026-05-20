'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AbcItem, ProfileParams } from '@/lib/assistants/types';
import { UseProfilePicker } from './UseProfilePicker';

// Sub-projeto 31 — Form da análise ABC.
//
// Fluxo principal: upload .xlsx / .csv → endpoint /import retorna items
// + warnings → preview na lista. User pode adicionar/remover linhas
// manualmente e ajustar o nome da análise antes de submeter.
//
// Lista de itens é compacta — 500-5000 linhas é o range esperado. Em
// vez de renderizar todos (problema de perf), mostramos apenas os top
// 50 + contagem total. Edição é por upload (re-importar) ou exclusão
// individual; v1 não suporta editar valor inline (overhead grande).

export type AbcFormValues = {
  templateId: string;
  analysisName: string;
  analysisPeriod: string;
  notes: string;
  consolidate: boolean;
  items: AbcItem[];
  perfilId?: string;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
};

const MAX_PREVIEW_ROWS = 50;

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function AbcForm({
  onSubmit,
}: {
  onSubmit: (v: AbcFormValues) => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [analysisName, setAnalysisName] = useState('');
  const [analysisPeriod, setAnalysisPeriod] = useState('');
  const [notes, setNotes] = useState('');
  const [consolidate, setConsolidate] = useState(true);
  const [items, setItems] = useState<AbcItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [perfilId, setPerfilId] = useState<string | undefined>(undefined);

  function handleProfileSelected(id: string, p: ProfileParams) {
    if (analysisName.trim().length === 0)
      setAnalysisName(`Análise ABC — ${p.nomeCategoria}`);
    if (notes.trim().length === 0)
      setNotes(`Categoria de compra: ${p.nomeCategoria}. ${p.descricao}`);
    setPerfilId(id);
  }

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/assistants/templates?type=abc');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { templates: Template[] };
      setTemplates(data.templates);
      if (data.templates.length > 0) {
        setTemplateId((prev) => prev || data.templates[0]!.id);
      }
    } catch (err) {
      toast.error('Falha ao carregar templates', { description: String(err) });
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/assistants/abc/import', {
        method: 'POST',
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        max_bytes?: number;
        items?: AbcItem[];
        warnings?: string[];
      };
      if (!res.ok || data.error) {
        if (data.error === 'unsupported_mime') {
          toast.error('Apenas XLSX, XLS ou CSV são aceitos.');
        } else if (data.error === 'file_too_large') {
          toast.error('Arquivo acima de 10 MB.');
        } else if (data.error === 'rate_limited') {
          toast.error('Limite atingido. Tente novamente em 1 min.');
        } else {
          toast.error('Falha ao importar', {
            description: data.message ?? `status ${res.status}`,
          });
        }
        return;
      }
      const importedItems = data.items ?? [];
      const warnings = data.warnings ?? [];
      setItems(importedItems);
      if (warnings.length > 0) {
        toast.info(`${importedItems.length} itens importados`, {
          description: warnings.slice(0, 3).join(' · '),
        });
      } else {
        toast.success(`${importedItems.length} itens importados`);
      }
    } catch (err) {
      toast.error('Falha no upload', { description: String(err) });
    } finally {
      setImporting(false);
    }
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalSpend = useMemo(
    () => items.reduce((acc, it) => acc + it.spend, 0),
    [items],
  );

  // Top-50 preview, sorted by spend desc for visual clarity. Real
  // classification happens server-side.
  const previewItems = useMemo(() => {
    const sorted = items.slice().sort((a, b) => b.spend - a.spend);
    return sorted.slice(0, MAX_PREVIEW_ROWS);
  }, [items]);

  function valid(): boolean {
    return (
      templateId.length > 0 &&
      analysisName.trim().length >= 1 &&
      items.length >= 5
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid()) return;
    onSubmit({
      templateId,
      analysisName: analysisName.trim(),
      analysisPeriod: analysisPeriod.trim(),
      notes: notes.trim(),
      consolidate,
      items,
      perfilId,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-md border border-border bg-card p-6 max-w-5xl"
    >
      <div className="flex justify-end">
        <UseProfilePicker onProfileSelected={handleProfileSelected} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs font-medium block mb-1">Template</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={loadingTemplates}
            className="w-full rounded-md border border-input bg-background p-2 text-sm"
          >
            {loadingTemplates && <option value="">Carregando…</option>}
            {!loadingTemplates && templates.length === 0 && (
              <option value="">(nenhum template publicado)</option>
            )}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">
            Nome da análise <span className="text-destructive">*</span>
          </label>
          <Input
            value={analysisName}
            onChange={(e) => setAnalysisName(e.target.value)}
            placeholder="Ex: Spend MRO Q1/2025, Materiais de Obra 2024"
            maxLength={200}
          />
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">Período</label>
          <Input
            value={analysisPeriod}
            onChange={(e) => setAnalysisPeriod(e.target.value)}
            placeholder="Ex: 2025 Q1, Jan-Jun/2025"
            maxLength={120}
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="abc-consolidate"
            checked={consolidate}
            onChange={(e) => setConsolidate(e.target.checked)}
          />
          <label htmlFor="abc-consolidate" className="text-xs">
            Consolidar itens duplicados por nome (soma spend e qtd; recomendado
            quando o export tem múltiplos pedidos por SKU)
          </label>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-medium block mb-1">Observações</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contexto da análise, fornecedores estratégicos, restrições conhecidas…"
            className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[70px] focus:outline-none focus:ring-1 focus:ring-ring"
            maxLength={2000}
          />
        </div>
      </div>

      {/* ── Import upload ──────────────────────────────────────────── */}
      <div className="rounded-md border border-dashed border-border bg-background/40 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <h3 className="text-sm font-semibold">
              Importar planilha de spend (XLSX, XLS ou CSV)
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Aceita o template Procurement Garage (aba &quot;Relação de
              Pedidos&quot;) ou qualquer planilha com cabeçalho contendo
              colunas de nome/material e spend/valor/preço. Cap 10 MB.
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void handleImport(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Importando…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Enviar arquivo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Preview ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-end justify-between flex-wrap gap-2 pt-2 border-t border-border">
          <div>
            <h2 className="text-sm font-semibold">
              {items.length === 0
                ? 'Itens (envie um arquivo para preencher)'
                : `${items.length} itens carregados`}
            </h2>
            {items.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Spend total: <span className="font-medium">R$ {fmtBRL(totalSpend)}</span>
                {items.length > MAX_PREVIEW_ROWS &&
                  ` · mostrando top ${MAX_PREVIEW_ROWS} por spend`}
              </p>
            )}
          </div>
          {items.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems([])}
            >
              Limpar tudo
            </Button>
          )}
        </div>

        {items.length > 0 && (
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-background/80 text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-1.5 w-10">#</th>
                  <th className="text-left px-2 py-1.5">Item</th>
                  <th className="text-left px-2 py-1.5 w-40">Fornecedor</th>
                  <th className="text-right px-2 py-1.5 w-24">Qtd</th>
                  <th className="text-right px-2 py-1.5 w-32">Spend (R$)</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {previewItems.map((it, i) => {
                  const realIdx = items.indexOf(it);
                  return (
                    <tr
                      key={`${it.name}-${i}`}
                      className="border-t border-border"
                    >
                      <td className="px-2 py-1 text-muted-foreground tabular-nums">
                        {i + 1}
                      </td>
                      <td className="px-2 py-1">{it.name}</td>
                      <td className="px-2 py-1 text-muted-foreground truncate max-w-[12rem]">
                        {it.supplier ?? ''}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {it.quantity !== undefined ? it.quantity : ''}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {fmtBRL(it.spend)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(realIdx)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remover"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-border flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-muted-foreground">
          Mínimo 5 itens. A classificação A/B/C é calculada deterministicamente
          a partir do spend ordenado.
        </p>
        <Button type="submit" disabled={!valid()}>
          Gerar análise ABC
        </Button>
      </div>
    </form>
  );
}
