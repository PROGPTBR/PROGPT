'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HOMOLOGACAO_EXAMPLES } from '@/lib/assistants/examples';

// Sub-projeto 36 (fase 1) — form do assistente de Homologação de Fornecedor.
// O CNPJ é o essencial (dispara a consulta fiscal); o resto é opcional.

export type HomologacaoFormValues = {
  templateId: string;
  cnpj: string;
  fornecedorNome: string;
  setor: '' | 'comércio' | 'serviços' | 'indústria';
  faturamentoAnualBRL: string; // string no input
  notas: string;
};

type Template = { id: string; name: string; description: string | null };

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

/** Formata 14 dígitos como XX.XXX.XXX/XXXX-XX (parcial enquanto digita). */
function formatCnpj(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14);
  let out = d;
  if (d.length > 2) out = `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length > 5) out = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length > 8)
    out = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length > 12)
    out = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return out;
}

export function HomologacaoForm({
  onSubmit,
}: {
  onSubmit: (v: HomologacaoFormValues) => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [setor, setSetor] = useState<HomologacaoFormValues['setor']>('');
  const [faturamentoAnualBRL, setFaturamento] = useState('');
  const [notas, setNotas] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/assistants/templates?type=homologacao');
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
    const ex = HOMOLOGACAO_EXAMPLES[0];
    if (!ex) return;
    const p = ex.params;
    setCnpj(formatCnpj(p.cnpj));
    setFornecedorNome(p.fornecedorNome ?? '');
    setSetor(p.setor ?? '');
    setFaturamento(
      typeof p.faturamentoAnualBRL === 'number' ? String(p.faturamentoAnualBRL) : '',
    );
    setNotas(p.notas ?? '');
    toast.success('Exemplo carregado — ajuste e gere');
  }

  const cnpjValid = onlyDigits(cnpj).length === 14;
  const valid = templateId.length > 0 && cnpjValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      templateId,
      cnpj: cnpj.trim(),
      fornecedorNome: fornecedorNome.trim(),
      setor,
      faturamentoAnualBRL: faturamentoAnualBRL.trim(),
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

      {/* Seletor só aparece quando há mais de um template; com um único
          template (caso padrão) ele é auto-selecionado e o campo some. */}
      {templates.length > 1 && (
        <div>
          <label className="text-xs font-medium block mb-1">Template</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-md border border-input bg-background p-2 text-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {!loadingTemplates && templates.length === 0 && (
        <p className="text-[11px] text-destructive">
          Nenhum template publicado. Peça à administração para criar um em /admin/templates.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium block mb-1">
            CNPJ do fornecedor <span className="text-destructive">*</span>
          </label>
          <Input
            value={cnpj}
            onChange={(e) => setCnpj(formatCnpj(e.target.value))}
            placeholder="XX.XXX.XXX/0001-XX"
            inputMode="numeric"
            maxLength={20}
          />
          {cnpj.length > 0 && !cnpjValid && (
            <p className="text-[10px] text-destructive mt-0.5">
              Informe os 14 dígitos do CNPJ.
            </p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Nome do fornecedor (opcional)
          </label>
          <Input
            value={fornecedorNome}
            onChange={(e) => setFornecedorNome(e.target.value)}
            placeholder="Ex: WEG S.A."
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Setor (opcional — para comparar regime tributário)
          </label>
          <select
            value={setor}
            onChange={(e) =>
              setSetor(e.target.value as HomologacaoFormValues['setor'])
            }
            className="w-full rounded-md border border-input bg-background p-2 text-sm"
          >
            <option value="">—</option>
            <option value="comércio">Comércio</option>
            <option value="serviços">Serviços</option>
            <option value="indústria">Indústria</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Faturamento anual (R$, opcional)
          </label>
          <Input
            value={faturamentoAnualBRL}
            onChange={(e) => setFaturamento(e.target.value)}
            placeholder="Ex: 30000000000"
            inputMode="numeric"
            maxLength={20}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Notas (opcional)</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Contexto: contrato pretendido, criticidade, restrições conhecidas…"
          className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[70px] focus:outline-none focus:ring-1 focus:ring-ring"
          maxLength={2000}
        />
      </div>

      <div className="pt-2 border-t border-border flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-muted-foreground">
          Consultamos situação cadastral, score de risco e compliance na Receita
          (via BrasilAPI). O LLM produz a narrativa de homologação.
        </p>
        <Button type="submit" disabled={!valid}>
          Gerar homologação
        </Button>
      </div>
    </form>
  );
}
