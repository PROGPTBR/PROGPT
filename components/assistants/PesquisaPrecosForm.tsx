'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PESQUISA_PRECOS_EXAMPLES } from '@/lib/assistants/examples';

// Sub-projeto 37 (fase 1) — form do assistente de Pesquisa de Preços.
// Lista de itens (descrição livre → CATMAT) + UF opcional pra recorte regional.

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;

type ItemRow = { descricao: string; unidade: string; quantidade: string };

export type PesquisaPrecosFormValues = {
  templateId: string;
  titulo: string;
  uf: string;
  itens: ItemRow[];
  notas: string;
};

type Template = { id: string; name: string; description: string | null };

const emptyItem = (): ItemRow => ({ descricao: '', unidade: '', quantidade: '' });

export function PesquisaPrecosForm({
  onSubmit,
}: {
  onSubmit: (v: PesquisaPrecosFormValues) => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [uf, setUf] = useState('');
  const [itens, setItens] = useState<ItemRow[]>([emptyItem()]);
  const [notas, setNotas] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/assistants/templates?type=pesquisa_precos');
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

  function loadExample() {
    const ex = PESQUISA_PRECOS_EXAMPLES[0];
    if (!ex) return;
    const p = ex.params;
    setTitulo(p.titulo);
    setUf(p.uf ?? '');
    setItens(
      p.itens.map((i) => ({
        descricao: i.descricao,
        unidade: i.unidade ?? '',
        quantidade: typeof i.quantidade === 'number' ? String(i.quantidade) : '',
      })),
    );
    setNotas(p.notas ?? '');
    toast.success('Exemplo carregado — ajuste e gere');
  }

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItens((prev) => (prev.length >= 10 ? prev : [...prev, emptyItem()]));
  }
  function removeItem(idx: number) {
    setItens((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  const filledItems = itens.filter((i) => i.descricao.trim().length >= 2);
  const valid = templateId.length > 0 && titulo.trim().length > 0 && filledItems.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      templateId,
      titulo: titulo.trim(),
      uf: uf.trim().toUpperCase(),
      itens,
      notas: notas.trim(),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-md border border-border bg-card p-6 max-w-3xl"
    >
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={loadExample}>
          Carregar exemplo
        </Button>
      </div>

      <div>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium block mb-1">
            Título da pesquisa <span className="text-destructive">*</span>
          </label>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Cesta de materiais de escritório — Q3"
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">UF (opcional)</label>
          <select
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            className="w-full rounded-md border border-input bg-background p-2 text-sm"
          >
            <option value="">Brasil (todas)</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-2">
          Itens a pesquisar <span className="text-destructive">*</span>{' '}
          <span className="text-muted-foreground font-normal">(até 10)</span>
        </label>
        <div className="space-y-2">
          {itens.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <Input
                value={item.descricao}
                onChange={(e) => updateItem(idx, { descricao: e.target.value })}
                placeholder="Descrição do item (ex: açúcar refinado branco 1kg)"
                maxLength={300}
                className="flex-1"
              />
              <Input
                value={item.quantidade}
                onChange={(e) => updateItem(idx, { quantidade: e.target.value })}
                placeholder="Qtd"
                inputMode="decimal"
                className="w-20"
              />
              <Input
                value={item.unidade}
                onChange={(e) => updateItem(idx, { unidade: e.target.value })}
                placeholder="Unid."
                maxLength={40}
                className="w-24"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(idx)}
                disabled={itens.length <= 1}
                aria-label="Remover item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {itens.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="mt-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar item
          </Button>
        )}
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Notas (opcional)</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Contexto: finalidade, especificação técnica, prazo…"
          className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[70px] focus:outline-none focus:ring-1 focus:ring-ring"
          maxLength={2000}
        />
      </div>

      <div className="pt-2 border-t border-border flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-muted-foreground">
          Buscamos preços praticados nas compras públicas (CATMAT / Painel de
          Preços). A mediana é o preço de referência; a faixa, sua banda de
          negociação.
        </p>
        <Button type="submit" disabled={!valid}>
          Pesquisar preços
        </Button>
      </div>
    </form>
  );
}
