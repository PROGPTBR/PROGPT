'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Form values match PorterRequestSchema in lib/assistants/types.ts.
export type PorterFormValues = {
  templateId: string;
  categoria: string;
  segmento: string;
  escopo: string;
  observacoes: string;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
};

const EMPTY: PorterFormValues = {
  templateId: '',
  categoria: '',
  segmento: '',
  escopo: '',
  observacoes: '',
};

export function PorterForm({
  onSubmit,
}: {
  onSubmit: (v: PorterFormValues) => void;
}) {
  const [values, setValues] = useState<PorterFormValues>(EMPTY);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/assistants/templates?type=porter');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { templates: Template[] };
      setTemplates(data.templates);
      if (data.templates.length > 0) {
        setValues((v) => ({
          ...v,
          templateId: v.templateId || data.templates[0]!.id,
        }));
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

  function setField<K extends keyof PorterFormValues>(
    k: K,
    v: PorterFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function valid(): boolean {
    return (
      values.templateId.length > 0 &&
      values.categoria.trim().length >= 2 &&
      values.categoria.trim().length <= 200
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid()) return;
        onSubmit(values);
      }}
      className="space-y-4 rounded-md border border-border bg-card p-6 max-w-2xl"
    >
      <div>
        <label className="text-xs font-medium block mb-1">Template</label>
        <select
          value={values.templateId}
          onChange={(e) => setField('templateId', e.target.value)}
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
          Categoria <span className="text-destructive">*</span>
        </label>
        <Input
          value={values.categoria}
          onChange={(e) => setField('categoria', e.target.value)}
          placeholder="Ex: Embalagens flexíveis, Fretes inbound, Tecnologia (SaaS de CRM)"
          maxLength={200}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Mínimo 2 caracteres. Quanto mais específica a categoria, melhor a
          análise.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Segmento</label>
        <Input
          value={values.segmento}
          onChange={(e) => setField('segmento', e.target.value)}
          placeholder="Ex: Direto / Indireto / B2B / B2C"
          maxLength={200}
        />
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">
          Escopo geográfico ou de mercado
        </label>
        <Input
          value={values.escopo}
          onChange={(e) => setField('escopo', e.target.value)}
          placeholder="Ex: Brasil, América Latina, Global, Nicho farmacêutico"
          maxLength={300}
        />
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">
          Observações adicionais
        </label>
        <textarea
          value={values.observacoes}
          onChange={(e) => setField('observacoes', e.target.value)}
          placeholder="Contexto da empresa, dados de share que você tem, restrições conhecidas, fornecedores atuais…"
          className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[100px] focus:outline-none focus:ring-1 focus:ring-ring"
          maxLength={2000}
        />
        <div className="text-[10px] text-muted-foreground text-right mt-0.5">
          {values.observacoes.length}/2000
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={!valid()}>
          Gerar análise das 5 Forças
        </Button>
      </div>
    </form>
  );
}
