'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Send, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScorecardImportDialog } from './ScorecardImportDialog';
import { SCORECARD_EXAMPLES } from '@/lib/assistants/examples';
import {
  DEFAULT_SCORECARD_CRITERIA,
  SCORECARD_DEFAULT_THRESHOLDS,
  SCORECARD_STRATEGIC_CAPABILITIES,
} from '@/lib/assistants/types';
import type { ScorecardCriterion, ScorecardSupplier, ScorecardParams } from '@/lib/assistants/types';

export type ScorecardFormValues = {
  templateId: string;
  params: ScorecardParams;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
};

// Mutable draft types for form state
type CriterionDraft = {
  id: string; // stable — slug of original label; kept when label changes
  label: string;
  weight: string; // string for input, coerced on submit
  group: string; // '' = sem grupo (modo simples) — Batch J
  basis: string; // "base para pontuação" — Batch J
};

type SupplierDraft = {
  id: string; // stable UI-only key; never sent to server
  name: string;
  segment: string;
  scores: Record<string, string>; // criterionId → string (number input value)
  strategicCapabilities: string[]; // ids marcados — Batch J (bônus no score)
};

function labelToId(label: string): string {
  // NFD normalize, strip accents, lowercase, non-alnum → '-', collapse '-', trim
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'criterio';
}

function makeEmptyCriteria(): CriterionDraft[] {
  return DEFAULT_SCORECARD_CRITERIA.map((c) => ({
    id: c.id,
    label: c.label,
    weight: String(c.weight),
    group: '',
    basis: '',
  }));
}

function makeEmptySupplier(criteria: CriterionDraft[], i = 0, scale = 10): SupplierDraft {
  const scores: Record<string, string> = {};
  for (const c of criteria) {
    scores[c.id] = String(Math.ceil(scale / 2));
  }
  return {
    id: `fornecedor-${Date.now()}-${i}`,
    name: '',
    segment: '',
    scores,
    strategicCapabilities: [],
  };
}

export function ScorecardForm({ onSubmit }: { onSubmit: (v: ScorecardFormValues) => void }) {
  const [templateId, setTemplateId] = useState('');
  const [scorecardName, setScorecardName] = useState('');
  const [period, setPeriod] = useState('');
  const [notes, setNotes] = useState('');
  const [strategicThreshold, setStrategicThreshold] = useState(
    String(SCORECARD_DEFAULT_THRESHOLDS.strategic),
  );
  const [developmentThreshold, setDevelopmentThreshold] = useState(
    String(SCORECARD_DEFAULT_THRESHOLDS.development),
  );
  const [scale, setScale] = useState<'5' | '10'>('10');
  const [criteria, setCriteria] = useState<CriterionDraft[]>(makeEmptyCriteria);
  const [suppliers, setSuppliers] = useState<SupplierDraft[]>(() => [
    makeEmptySupplier(makeEmptyCriteria(), 0),
    makeEmptySupplier(makeEmptyCriteria(), 1),
  ]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/assistants/templates?type=scorecard');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { templates: Template[] };
      setTemplates(data.templates);
      if (data.templates.length > 0 && !templateId) {
        setTemplateId(data.templates[0]!.id);
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

  // ── Scale (Batch J) ───────────────────────────────────────────────────────
  // Trocar a escala re-clampa as notas já digitadas para o novo teto — evita
  // que um score "8" sobreviva silenciosamente numa escala 1–5.
  function handleScaleChange(next: '5' | '10') {
    const nextMax = Number(next);
    setSuppliers((prev) =>
      prev.map((s) => ({
        ...s,
        scores: Object.fromEntries(
          Object.entries(s.scores).map(([cid, v]) => [
            cid,
            String(Math.min(nextMax, Math.max(0, Number(v) || 0))),
          ]),
        ),
      })),
    );
    setScale(next);
  }

  // ── Criteria editor helpers ──────────────────────────────────────────────

  function updateCriterionLabel(i: number, label: string) {
    setCriteria((prev) => {
      const next = prev.map((c, idx) => (idx === i ? { ...c, label } : c));
      return next;
    });
  }

  function updateCriterionWeight(i: number, weight: string) {
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { ...c, weight } : c)));
  }

  function updateCriterionGroup(i: number, group: string) {
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { ...c, group } : c)));
  }

  function updateCriterionBasis(i: number, basis: string) {
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { ...c, basis } : c)));
  }

  function addCriterion() {
    const newC: CriterionDraft = {
      id: `criterio-${Date.now()}`,
      label: '',
      weight: '10',
      group: '',
      basis: '',
    };
    setCriteria((prev) => [...prev, newC]);
    // Add default score for new criterion to all suppliers
    const mid = String(Math.ceil(Number(scale) / 2));
    setSuppliers((prev) =>
      prev.map((s) => ({ ...s, scores: { ...s.scores, [newC.id]: mid } })),
    );
  }

  function removeCriterion(i: number) {
    const removed = criteria[i];
    if (!removed) return;
    setCriteria((prev) => prev.filter((_, idx) => idx !== i));
    // Remove score key from all suppliers
    setSuppliers((prev) =>
      prev.map((s) => {
        const scores = { ...s.scores };
        delete scores[removed.id];
        return { ...s, scores };
      }),
    );
  }

  // ── Supplier grid helpers ────────────────────────────────────────────────

  function updateSupplierField(i: number, field: 'name' | 'segment', value: string) {
    setSuppliers((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
    );
  }

  function updateSupplierScore(supplierIdx: number, criterionId: string, value: string) {
    setSuppliers((prev) =>
      prev.map((s, idx) =>
        idx === supplierIdx
          ? { ...s, scores: { ...s.scores, [criterionId]: value } }
          : s,
      ),
    );
  }

  function addSupplier() {
    setSuppliers((prev) => [...prev, makeEmptySupplier(criteria, prev.length, Number(scale))]);
  }

  function toggleSupplierCapability(supplierIdx: number, capabilityId: string) {
    setSuppliers((prev) =>
      prev.map((s, idx) => {
        if (idx !== supplierIdx) return s;
        const has = s.strategicCapabilities.includes(capabilityId);
        return {
          ...s,
          strategicCapabilities: has
            ? s.strategicCapabilities.filter((id) => id !== capabilityId)
            : [...s.strategicCapabilities, capabilityId],
        };
      }),
    );
  }

  function removeSupplier(i: number) {
    setSuppliers((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Import handler ────────────────────────────────────────────────────────

  function handleImported(result: {
    criteria: ScorecardCriterion[];
    suppliers: ScorecardSupplier[];
    warnings: string[];
  }) {
    if (result.warnings.length > 0) {
      toast.warning(`${result.warnings.length} aviso(s)`, {
        description: result.warnings.slice(0, 3).join(' · '),
      });
    }
    // Import continua assumindo escala 0–10 (a escala do arquivo enviado não
    // é detectável na grade) — reseta a escala do form para 10.
    setScale('10');
    const newCriteria: CriterionDraft[] = result.criteria.map((c) => ({
      id: c.id,
      label: c.label,
      weight: String(c.weight),
      group: c.group ?? '',
      basis: c.basis ?? '',
    }));
    const importTs = Date.now();
    const newSuppliers: SupplierDraft[] = result.suppliers.map((s, i) => {
      const scores: Record<string, string> = {};
      for (const c of newCriteria) {
        scores[c.id] = String(s.scores[c.id] ?? 5);
      }
      return {
        id: `fornecedor-${importTs}-${i}`,
        name: s.name,
        segment: s.segment ?? '',
        scores,
        strategicCapabilities: [],
      };
    });
    setCriteria(newCriteria);
    setSuppliers(newSuppliers);
  }

  function loadExample(exampleIndex: number) {
    const ex = SCORECARD_EXAMPLES[exampleIndex];
    if (!ex) return;
    const p = ex.params;
    const exScale = p.scale === 5 ? '5' : '10';
    const newCriteria: CriterionDraft[] = p.criteria.map((c) => ({
      id: c.id,
      label: c.label,
      weight: String(c.weight),
      group: c.group ?? '',
      basis: c.basis ?? '',
    }));
    const ts = Date.now();
    const newSuppliers: SupplierDraft[] = p.suppliers.map((s, i) => {
      const scores: Record<string, string> = {};
      for (const c of newCriteria) {
        scores[c.id] = String(s.scores[c.id] ?? 5);
      }
      return {
        id: `fornecedor-${ts}-${i}`,
        name: s.name,
        segment: s.segment ?? '',
        scores,
        strategicCapabilities: [...(s.strategicCapabilities ?? [])],
      };
    });
    setScale(exScale);
    setCriteria(newCriteria);
    setSuppliers(newSuppliers);
    setScorecardName(p.scorecardName);
    setPeriod(p.period ?? '');
    setNotes(p.notes ?? '');
    setStrategicThreshold(String(p.thresholds.strategic));
    setDevelopmentThreshold(String(p.thresholds.development));
    toast.success('Exemplo carregado — ajuste e gere o scorecard');
  }

  // ── Validation ────────────────────────────────────────────────────────────

  const validCriteria = criteria.filter((c) => c.label.trim().length > 0);
  const validSuppliers = suppliers.filter((s) => s.name.trim().length > 0);
  const totalWeight = validCriteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  const strategicNum = Number(strategicThreshold);
  const developmentNum = Number(developmentThreshold);
  const thresholdsValid =
    Number.isFinite(strategicNum) &&
    Number.isFinite(developmentNum) &&
    strategicNum > developmentNum &&
    strategicNum >= 1 &&
    strategicNum <= 100 &&
    developmentNum >= 0 &&
    developmentNum <= 99;

  const valid =
    templateId.length > 0 &&
    scorecardName.trim().length > 0 &&
    validCriteria.length >= 1 &&
    validSuppliers.length >= 1 &&
    totalWeight > 0 &&
    validCriteria.every((c) => Number(c.weight) > 0) &&
    thresholdsValid;

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;

    // Resolve criterion ids: if label changed from original, keep stored id.
    // For newly added criteria (id starts with 'criterio-'), derive from label.
    // De-dup: if a computed id collides with one already assigned, append -2, -3, …
    const assignedIds = new Set<string>();
    const idMap: Record<string, string> = {}; // editing id → unique final id

    const finalCriteria: ScorecardCriterion[] = validCriteria.map((c) => {
      const base = c.id.startsWith('criterio-') ? labelToId(c.label) : c.id;
      let finalId = base;
      let suffix = 2;
      while (assignedIds.has(finalId)) {
        finalId = `${base}-${suffix}`;
        suffix++;
      }
      assignedIds.add(finalId);
      idMap[c.id] = finalId;
      return {
        id: finalId,
        label: c.label.trim(),
        weight: Number(c.weight) || 0,
        group: c.group.trim(),
        basis: c.basis.trim(),
      };
    });

    const scaleNum = Number(scale) as 5 | 10;
    const finalSuppliers: ScorecardSupplier[] = validSuppliers.map((s) => {
      const scores: Record<string, number> = {};
      for (const c of validCriteria) {
        const finalId = idMap[c.id] ?? c.id;
        scores[finalId] = Math.min(scaleNum, Math.max(0, Number(s.scores[c.id]) || 0));
      }
      return {
        name: s.name.trim(),
        segment: s.segment.trim(),
        scores,
        strategicCapabilities: s.strategicCapabilities,
      };
    });

    const params: ScorecardParams = {
      scorecardName: scorecardName.trim(),
      period: period.trim(),
      notes: notes.trim(),
      scale: scaleNum,
      criteria: finalCriteria,
      suppliers: finalSuppliers,
      thresholds: { strategic: strategicNum, development: developmentNum },
    };

    onSubmit({ templateId, params });
  }

  return (
    <form className="space-y-6 max-w-5xl" onSubmit={handleSubmit}>
      {/* ── Header fields ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Template auto-selecionado (único) — dropdown removido; só avisa se faltar. */}
        {!loadingTemplates && templates.length === 0 && (
          <div className="sm:col-span-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs p-3">
            Nenhum template Scorecard disponível. Peça à administração para criar em
            /admin/templates.
          </div>
        )}
        <div>
          <label className="text-xs font-medium block mb-1">
            Nome do scorecard <span className="text-destructive">*</span>
          </label>
          <Input
            value={scorecardName}
            onChange={(e) => setScorecardName(e.target.value)}
            placeholder="Ex: Fornecedores de Aço 2026"
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Período</label>
          <Input
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="Ex: Q2 2026, Jan-Jun 2026"
            maxLength={120}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Escala das notas</label>
          <div className="flex items-center gap-1 rounded-md border border-input p-0.5 w-fit">
            {(['10', '5'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleScaleChange(s)}
                className={`px-3 py-1.5 text-xs rounded ${
                  scale === s
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                0–{s}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            1–5 segue a planilha do diretor (Batch J); trocar re-ajusta notas já digitadas.
          </p>
        </div>
      </div>

      {/* ── Thresholds ───────────────────────────────────────────────────── */}
      <div>
        <label className="text-sm font-medium block mb-2">Thresholds de faixa (0–100)</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Estratégico ≥
            </label>
            <Input
              type="number"
              min={1}
              max={100}
              value={strategicThreshold}
              onChange={(e) => setStrategicThreshold(e.target.value)}
              className="tabular-nums"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Desenvolvimento ≥
            </label>
            <Input
              type="number"
              min={0}
              max={99}
              value={developmentThreshold}
              onChange={(e) => setDevelopmentThreshold(e.target.value)}
              className="tabular-nums"
            />
          </div>
          <div className="sm:col-span-2 flex items-end pb-0.5">
            {!thresholdsValid && (
              <p className="text-xs text-destructive">
                Estratégico deve ser maior que Desenvolvimento (e entre 1–100).
              </p>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Score ≥ Estratégico → faixa Estratégico · Score ≥ Desenvolvimento → Desenvolvimento · abaixo → Saída/substituição.
        </p>
      </div>

      {/* ── Criteria editor ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">
            Critérios de avaliação{' '}
            <span className="text-xs font-normal text-muted-foreground">
              (Σpesos = {totalWeight}
              {totalWeight !== 100 && (
                <span className="text-amber-500 ml-1">≠ 100 · o backend normaliza</span>
              )}
              )
            </span>
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" variant="outline" size="sm" onClick={() => loadExample(0)}>
              Carregar exemplo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => loadExample(1)}>
              Carregar planilha do diretor
            </Button>
            <Button type="button" size="sm" onClick={addCriterion}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar critério
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2 font-medium">Grupo</th>
                <th className="text-left p-2 font-medium">Critério</th>
                <th className="text-right p-2 font-medium w-28">Peso (%)</th>
                <th className="text-left p-2 font-medium">Base para pontuação</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c, i) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-1">
                    <input
                      value={c.group}
                      onChange={(e) => updateCriterionGroup(i, e.target.value)}
                      placeholder="(opcional)"
                      className="w-full min-w-[100px] bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring text-muted-foreground"
                      maxLength={80}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      value={c.label}
                      onChange={(e) => updateCriterionLabel(i, e.target.value)}
                      placeholder="Ex: Qualidade"
                      className="w-full min-w-[120px] bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring"
                      maxLength={80}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={c.weight}
                      onChange={(e) => updateCriterionWeight(i, e.target.value)}
                      min={0}
                      max={100}
                      step={1}
                      className="w-full text-right bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      value={c.basis}
                      onChange={(e) => updateCriterionBasis(i, e.target.value)}
                      placeholder="Ex: Comprovante técnico recebe todos os pontos"
                      className="w-full min-w-[180px] bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring text-muted-foreground"
                      maxLength={300}
                    />
                  </td>
                  <td className="p-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeCriterion(i)}
                      aria-label="Remover critério"
                      className="text-muted-foreground hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {criteria.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-sm text-muted-foreground p-4">
                    Nenhum critério. Clique &quot;Adicionar critério&quot; para começar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Grupo e base para pontuação são opcionais — usados no relatório e nas planilhas exportadas para organizar critérios em grupos (ex.: Requisitos, Termos e condições) com uma justificativa qualitativa por critério.
        </p>
        {totalWeight === 0 && criteria.length > 0 && (
          <p className="text-xs text-destructive mt-1">
            A soma dos pesos não pode ser zero.
          </p>
        )}
      </div>

      {/* ── Supplier grid (dynamic columns) ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">
            Fornecedores
          </label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              Importar .xlsx
            </Button>
            <Button type="button" size="sm" onClick={addSupplier}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar fornecedor
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2 font-medium whitespace-nowrap">Fornecedor</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">Segmento</th>
                {criteria.map((c) => (
                  <th
                    key={c.id}
                    className="p-2 font-medium text-center whitespace-nowrap"
                    title={c.group ? `${c.group} — ${c.label || '(sem nome)'}` : c.label || '(sem nome)'}
                  >
                    {c.group && (
                      <span className="block text-[9px] font-normal text-muted-foreground normal-case">
                        {c.group.slice(0, 16)}
                      </span>
                    )}
                    {c.label.length > 0
                      ? c.label.slice(0, 12) + (c.label.length > 12 ? '…' : '')
                      : '—'}
                    <span className="block text-[9px] font-normal text-muted-foreground">
                      0–{scale}
                    </span>
                  </th>
                ))}
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s, si) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-1">
                    <input
                      value={s.name}
                      onChange={(e) => updateSupplierField(si, 'name', e.target.value)}
                      placeholder="Ex: Acelor Mittal"
                      className="w-full min-w-[120px] bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring"
                      maxLength={120}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      value={s.segment}
                      onChange={(e) => updateSupplierField(si, 'segment', e.target.value)}
                      placeholder="(opcional)"
                      className="w-full min-w-[80px] bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring"
                      maxLength={120}
                    />
                  </td>
                  {criteria.map((c) => (
                    <td key={c.id} className="p-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={Number(scale)}
                        step={0.5}
                        value={s.scores[c.id] ?? '5'}
                        onChange={(e) => updateSupplierScore(si, c.id, e.target.value)}
                        className="w-14 text-center bg-transparent px-1 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                      />
                    </td>
                  ))}
                  <td className="p-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeSupplier(si)}
                      aria-label="Remover fornecedor"
                      className="text-muted-foreground hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td
                    colSpan={criteria.length + 3}
                    className="text-center text-sm text-muted-foreground p-6"
                  >
                    Nenhum fornecedor. Clique &quot;Adicionar fornecedor&quot; para começar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Notas de 0 a {scale} (step 0,5). O assistente calcula o score ponderado e classifica cada fornecedor na faixa correspondente.
        </p>
      </div>

      {/* ── Capacidades estratégicas (Batch J) ─────────────────────────────── */}
      <div>
        <label className="text-sm font-medium block mb-2">
          Capacidades estratégicas{' '}
          <span className="text-xs font-normal text-muted-foreground">
            (opcional — cada item marcado soma +{1} ponto ao score final do fornecedor)
          </span>
        </label>
        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2 font-medium whitespace-nowrap">Fornecedor</th>
                {SCORECARD_STRATEGIC_CAPABILITIES.map((cap) => (
                  <th
                    key={cap.id}
                    className="p-2 font-medium text-center"
                    title={cap.label}
                  >
                    <span className="block max-w-[90px] mx-auto leading-tight normal-case font-normal text-muted-foreground">
                      {cap.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.filter((s) => s.name.trim().length > 0).map((s) => {
                const si = suppliers.findIndex((x) => x.id === s.id);
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-2 font-medium whitespace-nowrap">{s.name}</td>
                    {SCORECARD_STRATEGIC_CAPABILITIES.map((cap) => (
                      <td key={cap.id} className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={s.strategicCapabilities.includes(cap.id)}
                          onChange={() => toggleSupplierCapability(si, cap.id)}
                          aria-label={`${s.name} — ${cap.label}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
              {validSuppliers.length === 0 && (
                <tr>
                  <td
                    colSpan={SCORECARD_STRATEGIC_CAPABILITIES.length + 1}
                    className="text-center text-sm text-muted-foreground p-4"
                  >
                    Nomeie os fornecedores acima para marcar capacidades estratégicas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      <div>
        <label className="text-xs font-medium block mb-1">Notas adicionais (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contexto da avaliação: período, escopo, regras de negócio específicas…"
          className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring"
          maxLength={2000}
        />
      </div>

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {validSuppliers.length < 1
            ? 'Adicione pelo menos 1 fornecedor com nome para gerar a análise'
            : `${validSuppliers.length} fornecedor(es) · ${validCriteria.length} critério(s)`}
        </div>
        <Button type="submit" disabled={!valid || loadingTemplates}>
          <Send className="h-4 w-4 mr-1" />
          Gerar scorecard
        </Button>
      </div>

      <ScorecardImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />
    </form>
  );
}
