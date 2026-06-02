'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PROFILE_EXAMPLES } from '@/lib/assistants/examples';
import type {
  PartialProfile,
  ProfileParams,
  ProfileStakeholder,
} from '@/lib/assistants/types';

// Sub-projeto 33 — Form da Análise da Categoria (Perfil).
//
// 15 campos em 5 blocos. Upload opcional (PDF/DOCX) pré-preenche
// chamando /api/assistants/profile/extract.

export type ProfileFormValues = ProfileParams & { templateId: string };

type Template = {
  id: string;
  name: string;
  description: string | null;
};

const PAPEL_OPTIONS: Array<{ value: ProfileStakeholder['papel']; label: string }> = [
  { value: 'usuario', label: 'Usuário / Requisitante' },
  { value: 'aprovador', label: 'Aprovador / Sponsor' },
  { value: 'operacao', label: 'Operação / Manutenção' },
];

const PRIORIDADE_OPTIONS: Array<{
  value: ProfileParams['prioridadeEstrategica'];
  label: string;
}> = [
  { value: 'custo', label: 'Custo' },
  { value: 'qualidade', label: 'Qualidade' },
  { value: 'inovacao', label: 'Inovação' },
  { value: 'sustentabilidade', label: 'Sustentabilidade' },
];

export function ProfileForm({
  onSubmit,
}: {
  onSubmit: (v: ProfileFormValues) => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Form state — começa vazio, mas pode ser pré-preenchido via upload.
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [subSegmentos, setSubSegmentos] = useState<string[]>(['']);
  const [escopoIncluido, setEscopoIncluido] = useState('');
  const [escopoNaoIncluido, setEscopoNaoIncluido] = useState('');
  const [spendAnualBRL, setSpendAnualBRL] = useState<string>(''); // string for input UX
  const [volumeFisico, setVolumeFisico] = useState('');
  const [numeroFornecedoresAtivos, setNumeroFornecedoresAtivos] = useState<string>('');
  const [sazonalidade, setSazonalidade] = useState('');
  const [requisitosTecnicos, setRequisitosTecnicos] = useState('');
  const [restricoesRegulatorias, setRestricoesRegulatorias] = useState('');
  const [criteriosAvaliacao, setCriteriosAvaliacao] = useState<string[]>(['']);
  const [stakeholders, setStakeholders] = useState<ProfileStakeholder[]>([
    { nome: '', papel: 'usuario' },
  ]);
  const [prioridadeEstrategica, setPrioridadeEstrategica] =
    useState<ProfileParams['prioridadeEstrategica']>('qualidade');
  const [observacoes, setObservacoes] = useState('');

  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/assistants/templates?type=profile');
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

  function applyExtracted(p: PartialProfile) {
    if (p.nomeCategoria) setNomeCategoria(p.nomeCategoria);
    if (p.descricao) setDescricao(p.descricao);
    if (p.subSegmentos && p.subSegmentos.length > 0) setSubSegmentos(p.subSegmentos);
    if (p.escopoIncluido) setEscopoIncluido(p.escopoIncluido);
    if (p.escopoNaoIncluido) setEscopoNaoIncluido(p.escopoNaoIncluido);
    if (typeof p.spendAnualBRL === 'number')
      setSpendAnualBRL(String(p.spendAnualBRL));
    if (p.volumeFisico) setVolumeFisico(p.volumeFisico);
    if (typeof p.numeroFornecedoresAtivos === 'number')
      setNumeroFornecedoresAtivos(String(p.numeroFornecedoresAtivos));
    if (p.sazonalidade) setSazonalidade(p.sazonalidade);
    if (p.requisitosTecnicos) setRequisitosTecnicos(p.requisitosTecnicos);
    if (p.restricoesRegulatorias)
      setRestricoesRegulatorias(p.restricoesRegulatorias);
    if (p.criteriosAvaliacao && p.criteriosAvaliacao.length > 0)
      setCriteriosAvaliacao(p.criteriosAvaliacao);
    if (p.stakeholders && p.stakeholders.length > 0)
      setStakeholders(p.stakeholders);
    if (p.prioridadeEstrategica) setPrioridadeEstrategica(p.prioridadeEstrategica);
    if (p.observacoes) setObservacoes(p.observacoes);
  }

  function loadExample() {
    const ex = PROFILE_EXAMPLES[0];
    if (!ex) return;
    applyExtracted(ex.params);
    toast.success('Exemplo carregado — ajuste e gere o perfil');
  }

  async function handleExtract(file: File) {
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/assistants/profile/extract', {
        method: 'POST',
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        params?: PartialProfile;
        warnings?: string[];
      };
      if (!res.ok || data.error) {
        if (data.error === 'unsupported_mime') {
          toast.error('Apenas PDF ou DOCX são aceitos.');
        } else if (data.error === 'file_too_large') {
          toast.error('Arquivo acima de 10 MB.');
        } else if (data.error === 'rate_limited') {
          toast.error('Limite atingido. Tente novamente em 1 min.');
        } else {
          toast.error('Falha na extração', {
            description: data.message ?? `status ${res.status}`,
          });
        }
        return;
      }
      const extracted = data.params ?? {};
      applyExtracted(extracted);
      const warnings = data.warnings ?? [];
      const filled = Object.keys(extracted).length;
      if (warnings.length > 0) {
        toast.info(`${filled} campos pré-preenchidos`, {
          description: `Ajuste manualmente: ${warnings.slice(0, 3).join(', ')}${warnings.length > 3 ? '…' : ''}`,
        });
      } else {
        toast.success(`${filled} campos pré-preenchidos`);
      }
    } catch (err) {
      toast.error('Falha no upload', { description: String(err) });
    } finally {
      setExtracting(false);
    }
  }

  function addSubSegmento() {
    setSubSegmentos((prev) => [...prev, '']);
  }
  function removeSubSegmento(i: number) {
    setSubSegmentos((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addCriterio() {
    setCriteriosAvaliacao((prev) => [...prev, '']);
  }
  function removeCriterio(i: number) {
    setCriteriosAvaliacao((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addStakeholder() {
    setStakeholders((prev) => [...prev, { nome: '', papel: 'usuario' }]);
  }
  function removeStakeholder(i: number) {
    setStakeholders((prev) => prev.filter((_, idx) => idx !== i));
  }

  function valid(): boolean {
    return (
      templateId.length > 0 &&
      nomeCategoria.trim().length >= 1 &&
      descricao.trim().length >= 1 &&
      subSegmentos.some((s) => s.trim().length > 0) &&
      escopoIncluido.trim().length >= 1 &&
      requisitosTecnicos.trim().length >= 1 &&
      criteriosAvaliacao.some((c) => c.trim().length > 0) &&
      stakeholders.some((s) => s.nome.trim().length > 0)
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid()) return;
    onSubmit({
      templateId,
      nomeCategoria: nomeCategoria.trim(),
      descricao: descricao.trim(),
      subSegmentos: subSegmentos.map((s) => s.trim()).filter((s) => s.length > 0),
      escopoIncluido: escopoIncluido.trim(),
      escopoNaoIncluido: escopoNaoIncluido.trim(),
      spendAnualBRL: spendAnualBRL ? Number(spendAnualBRL) : undefined,
      volumeFisico: volumeFisico.trim(),
      numeroFornecedoresAtivos: numeroFornecedoresAtivos
        ? Number(numeroFornecedoresAtivos)
        : undefined,
      sazonalidade: sazonalidade.trim(),
      requisitosTecnicos: requisitosTecnicos.trim(),
      restricoesRegulatorias: restricoesRegulatorias.trim(),
      criteriosAvaliacao: criteriosAvaliacao
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
      stakeholders: stakeholders
        .filter((s) => s.nome.trim().length > 0)
        .map((s) => ({ ...s, nome: s.nome.trim() })),
      prioridadeEstrategica,
      observacoes: observacoes.trim(),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-md border border-border bg-card p-6 max-w-5xl"
    >
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

      {/* ── Upload extract ──────────────────────────────────────────── */}
      <div className="rounded-md border border-dashed border-border bg-background/40 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <h3 className="text-sm font-semibold">
              Já tem um Perfil em PDF ou DOCX? (opcional)
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Suba o documento e o sistema extrai os campos para você
              revisar/ajustar. Cap 10 MB.
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void handleExtract(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={extracting}
              onClick={() => fileInputRef.current?.click()}
            >
              {extracting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Extraindo…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Enviar PDF/DOCX
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Identificação ──────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Identificação
        </legend>
        <div>
          <label className="text-xs font-medium block mb-1">
            Nome da categoria <span className="text-destructive">*</span>
          </label>
          <Input
            value={nomeCategoria}
            onChange={(e) => setNomeCategoria(e.target.value)}
            placeholder="Ex: Embalagens flexíveis, Serviços de TI - infraestrutura"
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Descrição <span className="text-destructive">*</span>
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="1 parágrafo descrevendo a categoria, seus produtos/serviços principais e função no negócio."
            className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[80px]"
            maxLength={2000}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Sub-segmentos <span className="text-destructive">*</span>
          </label>
          {subSegmentos.map((s, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <Input
                value={s}
                onChange={(e) =>
                  setSubSegmentos((prev) =>
                    prev.map((v, idx) => (idx === i ? e.target.value : v)),
                  )
                }
                placeholder="Ex: filmes laminados"
                maxLength={120}
              />
              {subSegmentos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSubSegmento(i)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSubSegmento}
            disabled={subSegmentos.length >= 20}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar sub-segmento
          </Button>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Escopo — incluído <span className="text-destructive">*</span>
          </label>
          <textarea
            value={escopoIncluido}
            onChange={(e) => setEscopoIncluido(e.target.value)}
            placeholder="Lista do que ENTRA nessa categoria de compra (bullets ou texto livre)."
            className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[70px]"
            maxLength={2000}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Escopo — não incluído (opcional)
          </label>
          <textarea
            value={escopoNaoIncluido}
            onChange={(e) => setEscopoNaoIncluido(e.target.value)}
            placeholder="O que NÃO faz parte dessa categoria mesmo sendo correlato (evita ambiguidade nos próximos passos)."
            className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[60px]"
            maxLength={2000}
          />
        </div>
      </fieldset>

      {/* ── Volume e mercado ──────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Volume e mercado (todos opcionais)
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">
              Spend anual estimado (R$)
            </label>
            <Input
              type="number"
              min="0"
              step="1"
              value={spendAnualBRL}
              onChange={(e) => setSpendAnualBRL(e.target.value)}
              placeholder="Ex: 5000000"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">
              Volume físico
            </label>
            <Input
              value={volumeFisico}
              onChange={(e) => setVolumeFisico(e.target.value)}
              placeholder="Ex: 12000 ton/ano"
              maxLength={120}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">
              Nº de fornecedores ativos
            </label>
            <Input
              type="number"
              min="0"
              step="1"
              value={numeroFornecedoresAtivos}
              onChange={(e) => setNumeroFornecedoresAtivos(e.target.value)}
              placeholder="Ex: 8"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Sazonalidade</label>
            <Input
              value={sazonalidade}
              onChange={(e) => setSazonalidade(e.target.value)}
              placeholder="Ex: pico no Q4, baixa no Q1"
              maxLength={300}
            />
          </div>
        </div>
      </fieldset>

      {/* ── Critérios técnicos ──────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Critérios técnicos
        </legend>
        <div>
          <label className="text-xs font-medium block mb-1">
            Requisitos técnicos chave <span className="text-destructive">*</span>
          </label>
          <textarea
            value={requisitosTecnicos}
            onChange={(e) => setRequisitosTecnicos(e.target.value)}
            placeholder="Normas, performance, especificações. Texto literal — será preservado palavra por palavra no doc."
            className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[90px]"
            maxLength={3000}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Restrições regulatórias (opcional)
          </label>
          <textarea
            value={restricoesRegulatorias}
            onChange={(e) => setRestricoesRegulatorias(e.target.value)}
            placeholder="Ex: ANVISA RDC 91/2001, ABNT NBR 14937. Texto literal — preservado no doc."
            className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[70px]"
            maxLength={2000}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Critérios de avaliação priorizados <span className="text-destructive">*</span>{' '}
            <span className="text-[10px] text-muted-foreground">
              (ordem importa — primeiro = mais importante)
            </span>
          </label>
          {criteriosAvaliacao.map((c, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-muted-foreground w-5 tabular-nums">
                {i + 1}.
              </span>
              <Input
                value={c}
                onChange={(e) =>
                  setCriteriosAvaliacao((prev) =>
                    prev.map((v, idx) => (idx === i ? e.target.value : v)),
                  )
                }
                placeholder={i === 0 ? 'Ex: Qualidade certificada' : ''}
                maxLength={200}
              />
              {criteriosAvaliacao.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCriterio(i)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCriterio}
            disabled={criteriosAvaliacao.length >= 10}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar critério
          </Button>
        </div>
      </fieldset>

      {/* ── Stakeholders ──────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Stakeholders <span className="text-destructive">*</span>
        </legend>
        {stakeholders.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={s.nome}
              onChange={(e) =>
                setStakeholders((prev) =>
                  prev.map((v, idx) =>
                    idx === i ? { ...v, nome: e.target.value } : v,
                  ),
                )
              }
              placeholder="Nome ou departamento"
              maxLength={100}
            />
            <select
              value={s.papel}
              onChange={(e) =>
                setStakeholders((prev) =>
                  prev.map((v, idx) =>
                    idx === i
                      ? {
                          ...v,
                          papel: e.target.value as ProfileStakeholder['papel'],
                        }
                      : v,
                  ),
                )
              }
              className="rounded-md border border-input bg-background p-2 text-sm w-44 flex-shrink-0"
            >
              {PAPEL_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {stakeholders.length > 1 && (
              <button
                type="button"
                onClick={() => removeStakeholder(i)}
                className="text-muted-foreground hover:text-destructive"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStakeholder}
          disabled={stakeholders.length >= 20}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar stakeholder
        </Button>
      </fieldset>

      {/* ── Prioridade ──────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Prioridade
        </legend>
        <div>
          <label className="text-xs font-medium block mb-1">
            Prioridade estratégica dominante <span className="text-destructive">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PRIORIDADE_OPTIONS.map((p) => (
              <label
                key={p.value}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  prioridadeEstrategica === p.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input hover:bg-background'
                }`}
              >
                <input
                  type="radio"
                  name="prioridade"
                  value={p.value}
                  checked={prioridadeEstrategica === p.value}
                  onChange={() => setPrioridadeEstrategica(p.value)}
                  className="hidden"
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Observações (opcional)</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Contexto adicional que não cabe nos outros campos."
            className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[60px]"
            maxLength={2000}
          />
        </div>
      </fieldset>

      <div className="pt-2 border-t border-border flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-muted-foreground">
          Requisitos técnicos e restrições regulatórias são preservados literalmente no documento gerado (campos audit-críticos).
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={loadExample}>
            Carregar exemplo
          </Button>
          <Button type="submit" disabled={!valid()}>
            Gerar Perfil
          </Button>
        </div>
      </div>
    </form>
  );
}
