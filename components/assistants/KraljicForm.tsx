'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KraljicItemTable, EMPTY_ITEM, type ItemDraft } from './KraljicItemTable';
import { KraljicImportDialog } from './KraljicImportDialog';
import { KraljicScoringAssistant } from './KraljicScoringAssistant';

export type KraljicFormValues = {
  templateId: string;
  portfolioName: string;
  analysisPeriod: string;
  notes: string;
  items: ItemDraft[];
  perfilId?: string;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
};

const EMPTY: KraljicFormValues = {
  templateId: '',
  portfolioName: '',
  analysisPeriod: '',
  notes: '',
  items: [{ ...EMPTY_ITEM }, { ...EMPTY_ITEM }],
};

export function KraljicForm({ onSubmit }: { onSubmit: (v: KraljicFormValues) => void }) {
  const [values, setValues] = useState<KraljicFormValues>(EMPTY);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [scoringRow, setScoringRow] = useState<number | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/assistants/templates?type=kraljic');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { templates: Template[] };
      setTemplates(data.templates);
      if (data.templates.length > 0 && !values.templateId) {
        setValues((v) => ({ ...v, templateId: data.templates[0]!.id }));
      }
    } catch (err) {
      toast.error('Falha ao carregar templates', { description: String(err) });
    } finally {
      setLoadingTemplates(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const validItems = values.items.filter(
    (it) => it.name.trim().length > 0 && Number(it.spendMM) >= 0,
  );
  const valid =
    values.templateId.length > 0 &&
    values.portfolioName.trim().length > 0 &&
    validItems.length >= 2;

  return (
    <form
      className="space-y-5 max-w-5xl"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit({ ...values, items: validItems });
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium block mb-1">
            Template <span className="text-destructive">*</span>
          </label>
          {loadingTemplates ? (
            <div className="text-xs text-muted-foreground">Carregando…</div>
          ) : templates.length === 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs p-3">
              Nenhum template Kraljic disponível. Peça à administração para criar em
              /admin/templates.
            </div>
          ) : (
            <select
              value={values.templateId}
              onChange={(e) => setValues((v) => ({ ...v, templateId: e.target.value }))}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.description ? ` — ${t.description.slice(0, 50)}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Nome do portfólio <span className="text-destructive">*</span>
          </label>
          <Input
            value={values.portfolioName}
            onChange={(e) => setValues((v) => ({ ...v, portfolioName: e.target.value }))}
            placeholder="Ex: Spend Industrial 2026"
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Período da análise</label>
          <Input
            value={values.analysisPeriod}
            onChange={(e) => setValues((v) => ({ ...v, analysisPeriod: e.target.value }))}
            placeholder="Ex: 2026 Q2, Jan-Jun 2026"
            maxLength={120}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Itens do portfólio</label>
          <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            Importar .xlsx
          </Button>
        </div>
        <KraljicItemTable
          items={values.items}
          onChange={(items) => setValues((v) => ({ ...v, items }))}
          onOpenScoringAssistant={(idx) => setScoringRow(idx)}
        />
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Notas adicionais (opcional)</label>
        <textarea
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          placeholder="Contexto da análise: período, escopo, regras de negócio específicas…"
          className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring"
          maxLength={2000}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {validItems.length < 2
            ? 'Adicione pelo menos 2 itens válidos com nome para gerar a análise'
            : `${validItems.length} item(ns) válidos prontos para análise`}
        </div>
        <Button type="submit" disabled={!valid || loadingTemplates}>
          <Send className="h-4 w-4 mr-1" />
          Gerar análise
        </Button>
      </div>

      <KraljicImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(items) =>
          setValues((v) => ({
            ...v,
            items: [...v.items.filter((it) => it.name.trim().length > 0), ...items],
          }))
        }
      />

      <KraljicScoringAssistant
        open={scoringRow !== null}
        rowIndex={scoringRow}
        current={scoringRow !== null ? values.items[scoringRow] ?? null : null}
        onClose={() => setScoringRow(null)}
        onApply={(idx, patch) =>
          setValues((v) => ({
            ...v,
            items: v.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
          }))
        }
      />
    </form>
  );
}
