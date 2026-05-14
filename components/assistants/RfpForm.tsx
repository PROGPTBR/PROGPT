'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Form values match RfpRequestSchema in lib/assistants/types.ts.
// Validation is duplicated lightly client-side to surface inline errors
// before the round-trip; the server is the source of truth.
export type RfpFormValues = {
  templateId: string;
  client: string;
  scope: string;
  category: string;
  deadline: string;
  budget: string;
  criteria: string[];
  notes: string;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
};

const DEFAULT_CRITERIA_SUGGESTIONS = [
  'Preço',
  'Suporte técnico',
  'SLA',
  'Certificações (ISO 27001, ISO 9001)',
  'Experiência em casos similares',
  'Prazo de implementação',
  'TCO 3 anos',
  'Saúde financeira do fornecedor',
];

const EMPTY: RfpFormValues = {
  templateId: '',
  client: '',
  scope: '',
  category: '',
  deadline: '',
  budget: '',
  criteria: [],
  notes: '',
};

export function RfpForm({ onSubmit }: { onSubmit: (v: RfpFormValues) => void }) {
  const [values, setValues] = useState<RfpFormValues>(EMPTY);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/assistants/templates?type=rfp');
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

  function toggleCriterion(c: string) {
    setValues((v) => ({
      ...v,
      criteria: v.criteria.includes(c)
        ? v.criteria.filter((x) => x !== c)
        : [...v.criteria, c],
    }));
  }

  const valid =
    values.templateId.length > 0 &&
    values.client.trim().length >= 2 &&
    values.scope.trim().length >= 10 &&
    values.category.trim().length >= 2 &&
    values.deadline.trim().length >= 1 &&
    values.budget.trim().length >= 1;

  return (
    <form
      className="space-y-5 max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(values);
      }}
    >
      <div>
        <label className="text-xs font-medium block mb-1">
          Template <span className="text-destructive">*</span>
        </label>
        {loadingTemplates ? (
          <div className="text-xs text-muted-foreground">Carregando…</div>
        ) : templates.length === 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs p-3">
            Nenhum template de RFP disponível ainda. Peça à administração para criar um em
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
          Empresa contratante <span className="text-destructive">*</span>
        </label>
        <Input
          value={values.client}
          onChange={(e) => setValues((v) => ({ ...v, client: e.target.value }))}
          placeholder="Ex: Embraer, Petrobras, Universidade Federal Fluminense"
          maxLength={200}
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Nome da empresa/órgão que está comprando — aparece nos termos do RFP.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">
          Escopo do que vai contratar <span className="text-destructive">*</span>
        </label>
        <textarea
          value={values.scope}
          onChange={(e) => setValues((v) => ({ ...v, scope: e.target.value }))}
          placeholder="Ex: Software de gestão de frota com 200+ veículos, integração com ERP SAP, módulo de telemetria em tempo real, e suporte a manutenção preventiva."
          className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[100px] focus:outline-none focus:ring-1 focus:ring-ring"
          maxLength={1000}
        />
        <div className="text-[10px] text-muted-foreground text-right mt-0.5">
          {values.scope.length}/1000 · mínimo 10
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium block mb-1">
            Categoria <span className="text-destructive">*</span>
          </label>
          <Input
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
            placeholder="Ex: TI / Software, Frota, Serviços de limpeza"
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Prazo de resposta dos fornecedores <span className="text-destructive">*</span>
          </label>
          <Input
            value={values.deadline}
            onChange={(e) => setValues((v) => ({ ...v, deadline: e.target.value }))}
            placeholder="Ex: 30 dias úteis, até 2026-06-15"
            maxLength={100}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium block mb-1">
            Orçamento estimado <span className="text-destructive">*</span>
          </label>
          <Input
            value={values.budget}
            onChange={(e) => setValues((v) => ({ ...v, budget: e.target.value }))}
            placeholder="Ex: R$ 200k–400k/ano, USD 50k one-time + 20k/ano"
            maxLength={200}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-2">Critérios de avaliação prioritários</label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_CRITERIA_SUGGESTIONS.map((c) => {
            const active = values.criteria.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCriterion(c)}
                className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary border-primary/40 font-medium'
                    : 'bg-background border-border hover:bg-accent'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Selecione os critérios que o template deve priorizar. Se nenhum, o modelo usa o
          padrão sênior de procurement.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">
          Notas adicionais (opcional)
        </label>
        <textarea
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          placeholder="Contexto extra: restrições internas, integrações específicas, etc."
          className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring"
          maxLength={2000}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={!valid || loadingTemplates}>
          Gerar RFP
        </Button>
      </div>
    </form>
  );
}
