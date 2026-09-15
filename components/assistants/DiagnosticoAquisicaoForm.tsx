'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  DiagnosticoAquisicaoParams,
  DiagnosticoNivel,
  DiagnosticoImpacto,
  DiagnosticoNatureza,
} from '@/lib/assistants/types';
import {
  DIAGNOSTICO_NIVEL,
  DIAGNOSTICO_IMPACTO,
  DIAGNOSTICO_NATUREZA,
  DIAGNOSTICO_NIVEL_LABELS,
  DIAGNOSTICO_IMPACTO_LABELS,
  DIAGNOSTICO_NATUREZA_LABELS,
} from '@/lib/assistants/types';

// Diagnóstico de Aquisição — form único com 2 blocos condicionais
// (CAPEX vs. OPEX) que aparecem conforme a classificação escolhida, seguindo
// exatamente a árvore descrita em "assistente de compras.docx".

export type DiagnosticoAquisicaoFormValues = DiagnosticoAquisicaoParams & {
  templateId: string;
};

type Template = { id: string; name: string; description: string | null };

function NivelPicker({
  value,
  onChange,
  labels,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  labels: Record<string, string>;
  options: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <label
          key={opt}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
            value === opt
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input hover:bg-background'
          }`}
        >
          <input
            type="radio"
            className="hidden"
            checked={value === opt}
            onChange={() => onChange(opt)}
          />
          {labels[opt]}
        </label>
      ))}
    </div>
  );
}

export function DiagnosticoAquisicaoForm({
  onSubmit,
}: {
  onSubmit: (v: DiagnosticoAquisicaoFormValues) => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [descricaoCompra, setDescricaoCompra] = useState('');
  const [categoria, setCategoria] = useState('');
  const [classificacao, setClassificacao] = useState<'CAPEX' | 'OPEX'>('CAPEX');
  const [natureza, setNatureza] = useState<DiagnosticoNatureza>('produto');
  const [criticidade, setCriticidade] = useState<DiagnosticoNivel>('media');
  const [complexidadeMercado, setComplexidadeMercado] = useState<DiagnosticoNivel>('media');
  const [impactoOperacional, setImpactoOperacional] = useState<DiagnosticoImpacto>('medio');
  const [notes, setNotes] = useState('');

  // CAPEX
  const [valorInvestimentoBRL, setValorInvestimentoBRL] = useState('');
  const [vidaUtilAnos, setVidaUtilAnos] = useState('');
  const [orcamentoAprovado, setOrcamentoAprovado] = useState(false);
  const [capacidadeAdicional, setCapacidadeAdicional] = useState('');
  const [custoAtualOperacao, setCustoAtualOperacao] = useState('');

  // OPEX
  const [gastoAnualBRL, setGastoAnualBRL] = useState('');
  const [orcamentoDisponivelBRL, setOrcamentoDisponivelBRL] = useState('');
  const [volumeEsperado, setVolumeEsperado] = useState('');
  const [numeroFornecedores, setNumeroFornecedores] = useState('');
  const [existeSla, setExisteSla] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/assistants/templates?type=diagnostico_aquisicao');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { templates: Template[] };
      setTemplates(data.templates);
      if (data.templates.length > 0) setTemplateId((prev) => prev || data.templates[0]!.id);
    } catch (err) {
      toast.error('Falha ao carregar templates', { description: String(err) });
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  function valid(): boolean {
    return templateId.length > 0 && descricaoCompra.trim().length >= 2;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid()) return;
    onSubmit({
      templateId,
      descricaoCompra: descricaoCompra.trim(),
      categoria: categoria.trim(),
      classificacao,
      natureza,
      criticidade,
      complexidadeMercado,
      impactoOperacional,
      notes: notes.trim(),
      capex:
        classificacao === 'CAPEX'
          ? {
              valorInvestimentoBRL: valorInvestimentoBRL ? Number(valorInvestimentoBRL) : undefined,
              vidaUtilAnos: vidaUtilAnos ? Number(vidaUtilAnos) : undefined,
              orcamentoAprovado,
              capacidadeAdicional: capacidadeAdicional.trim() || undefined,
              custoAtualOperacao: custoAtualOperacao.trim() || undefined,
            }
          : undefined,
      opex:
        classificacao === 'OPEX'
          ? {
              gastoAnualBRL: gastoAnualBRL ? Number(gastoAnualBRL) : undefined,
              orcamentoDisponivelBRL: orcamentoDisponivelBRL
                ? Number(orcamentoDisponivelBRL)
                : undefined,
              volumeEsperado: volumeEsperado.trim() || undefined,
              numeroFornecedores: numeroFornecedores ? Number(numeroFornecedores) : undefined,
              existeSla,
            }
          : undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-md border border-border bg-card p-6 max-w-3xl"
    >
      {!loadingTemplates && templates.length === 0 && (
        <p className="text-[11px] text-destructive">
          Nenhum template publicado. Peça à administração para criar um em /admin/templates.
        </p>
      )}

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          A aquisição
        </legend>
        <div>
          <label className="text-xs font-medium block mb-1">
            O que está sendo comprado? <span className="text-destructive">*</span>
          </label>
          <Input
            value={descricaoCompra}
            onChange={(e) => setDescricaoCompra(e.target.value)}
            placeholder="Ex: empilhadeira elétrica, serviço de manutenção predial, licença de software"
            maxLength={300}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Categoria (opcional)</label>
          <Input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ex: Equipamentos, Serviços de manutenção"
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Como esta aquisição foi classificada pela sua empresa?{' '}
            <span className="text-destructive">*</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            Essa classificação será utilizada como premissa do diagnóstico e não será alterada
            pelo assistente.
          </p>
          <NivelPicker
            value={classificacao}
            onChange={(v) => setClassificacao(v as 'CAPEX' | 'OPEX')}
            labels={{ CAPEX: 'CAPEX', OPEX: 'OPEX' }}
            options={['CAPEX', 'OPEX']}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Natureza</label>
          <NivelPicker
            value={natureza}
            onChange={(v) => setNatureza(v as DiagnosticoNatureza)}
            labels={DIAGNOSTICO_NATUREZA_LABELS}
            options={DIAGNOSTICO_NATUREZA}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Criticidade, complexidade e impacto
        </legend>
        <div>
          <label className="text-xs font-medium block mb-1">Criticidade</label>
          <NivelPicker
            value={criticidade}
            onChange={(v) => setCriticidade(v as DiagnosticoNivel)}
            labels={DIAGNOSTICO_NIVEL_LABELS}
            options={DIAGNOSTICO_NIVEL}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Complexidade de mercado</label>
          <NivelPicker
            value={complexidadeMercado}
            onChange={(v) => setComplexidadeMercado(v as DiagnosticoNivel)}
            labels={DIAGNOSTICO_NIVEL_LABELS}
            options={DIAGNOSTICO_NIVEL}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Impacto operacional</label>
          <NivelPicker
            value={impactoOperacional}
            onChange={(v) => setImpactoOperacional(v as DiagnosticoImpacto)}
            labels={DIAGNOSTICO_IMPACTO_LABELS}
            options={DIAGNOSTICO_IMPACTO}
          />
        </div>
      </fieldset>

      {classificacao === 'CAPEX' ? (
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dados de CAPEX (opcionais)
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Valor do investimento (R$)</label>
              <Input
                type="number"
                min="0"
                value={valorInvestimentoBRL}
                onChange={(e) => setValorInvestimentoBRL(e.target.value)}
                placeholder="Ex: 220000"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Vida útil esperada (anos)</label>
              <Input
                type="number"
                min="0"
                value={vidaUtilAnos}
                onChange={(e) => setVidaUtilAnos(e.target.value)}
                placeholder="Ex: 10"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Capacidade a adicionar</label>
              <Input
                value={capacidadeAdicional}
                onChange={(e) => setCapacidadeAdicional(e.target.value)}
                placeholder="Ex: +30 pallets/hora"
                maxLength={300}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Custo atual de operação</label>
              <Input
                value={custoAtualOperacao}
                onChange={(e) => setCustoAtualOperacao(e.target.value)}
                placeholder="Ex: R$ 12k/mês com o equipamento antigo"
                maxLength={300}
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={orcamentoAprovado}
              onChange={(e) => setOrcamentoAprovado(e.target.checked)}
            />
            Orçamento já aprovado
          </label>
        </fieldset>
      ) : (
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dados de OPEX (opcionais)
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Gasto anual (R$)</label>
              <Input
                type="number"
                min="0"
                value={gastoAnualBRL}
                onChange={(e) => setGastoAnualBRL(e.target.value)}
                placeholder="Ex: 480000"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Orçamento disponível (R$)</label>
              <Input
                type="number"
                min="0"
                value={orcamentoDisponivelBRL}
                onChange={(e) => setOrcamentoDisponivelBRL(e.target.value)}
                placeholder="Ex: 500000"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Volume esperado</label>
              <Input
                value={volumeEsperado}
                onChange={(e) => setVolumeEsperado(e.target.value)}
                placeholder="Ex: 12 visitas/mês"
                maxLength={300}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Nº de fornecedores que atendem</label>
              <Input
                type="number"
                min="0"
                value={numeroFornecedores}
                onChange={(e) => setNumeroFornecedores(e.target.value)}
                placeholder="Ex: 3"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={existeSla}
              onChange={(e) => setExisteSla(e.target.checked)}
            />
            Já existe SLA definido
          </label>
        </fieldset>
      )}

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notas (opcional)
        </legend>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contexto adicional relevante para o diagnóstico."
          className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[70px]"
          maxLength={2000}
        />
      </fieldset>

      <div className="pt-2 border-t border-border flex items-center justify-end">
        <Button type="submit" disabled={!valid()}>
          Gerar diagnóstico
        </Button>
      </div>
    </form>
  );
}
