'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Send, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScorecardImportDialog } from './ScorecardImportDialog';
import {
  DEFAULT_SCORECARD_CRITERIA,
  SCORECARD_DEFAULT_THRESHOLDS,
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
};

type SupplierDraft = {
  name: string;
  segment: string;
  scores: Record<string, string>; // criterionId → string (number input value)
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
  }));
}

function makeEmptySupplier(criteria: CriterionDraft[]): SupplierDraft {
  const scores: Record<string, string> = {};
  for (const c of criteria) {
    scores[c.id] = '5';
  }
  return { name: '', segment: '', scores };
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
  const [criteria, setCriteria] = useState<CriterionDraft[]>(makeEmptyCriteria);
  const [suppliers, setSuppliers] = useState<SupplierDraft[]>(() => [
    makeEmptySupplier(makeEmptyCriteria()),
    makeEmptySupplier(makeEmptyCriteria()),
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

  function addCriterion() {
    const newC: CriterionDraft = { id: `criterio-${Date.now()}`, label: '', weight: '10' };
    setCriteria((prev) => [...prev, newC]);
    // Add default score for new criterion to all suppliers
    setSuppliers((prev) =>
      prev.map((s) => ({ ...s, scores: { ...s.scores, [newC.id]: '5' } })),
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
    setSuppliers((prev) => [...prev, makeEmptySupplier(criteria)]);
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
    const newCriteria: CriterionDraft[] = result.criteria.map((c) => ({
      id: c.id,
      label: c.label,
      weight: String(c.weight),
    }));
    const newSuppliers: SupplierDraft[] = result.suppliers.map((s) => {
      const scores: Record<string, string> = {};
      for (const c of newCriteria) {
        scores[c.id] = String(s.scores[c.id] ?? 5);
      }
      return { name: s.name, segment: s.segment ?? '', scores };
    });
    setCriteria(newCriteria);
    setSuppliers(newSuppliers);
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
      return { id: finalId, label: c.label.trim(), weight: Number(c.weight) || 0 };
    });

    const finalSuppliers: ScorecardSupplier[] = validSuppliers.map((s) => {
      const scores: Record<string, number> = {};
      for (const c of validCriteria) {
        const finalId = idMap[c.id] ?? c.id;
        scores[finalId] = Math.min(10, Math.max(0, Number(s.scores[c.id]) || 0));
      }
      return { name: s.name.trim(), segment: s.segment.trim(), scores };
    });

    const params: ScorecardParams = {
      scorecardName: scorecardName.trim(),
      period: period.trim(),
      notes: notes.trim(),
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
        <div>
          <label className="text-xs font-medium block mb-1">
            Template <span className="text-destructive">*</span>
          </label>
          {loadingTemplates ? (
            <div className="text-xs text-muted-foreground">Carregando…</div>
          ) : templates.length === 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs p-3">
              Nenhum template Scorecard disponível. Peça à administração para criar em
              /admin/templates.
            </div>
          ) : (
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
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
          <Button type="button" size="sm" onClick={addCriterion}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar critério
          </Button>
        </div>

        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2 font-medium">Critério</th>
                <th className="text-right p-2 font-medium w-28">Peso (%)</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c, i) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-1">
                    <input
                      value={c.label}
                      onChange={(e) => updateCriterionLabel(i, e.target.value)}
                      placeholder="Ex: Qualidade"
                      className="w-full bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring"
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
                  <td colSpan={3} className="text-center text-sm text-muted-foreground p-4">
                    Nenhum critério. Clique &quot;Adicionar critério&quot; para começar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                    title={c.label || '(sem nome)'}
                  >
                    {c.label.length > 0
                      ? c.label.slice(0, 12) + (c.label.length > 12 ? '…' : '')
                      : '—'}
                    <span className="block text-[9px] font-normal text-muted-foreground">
                      0–10
                    </span>
                  </th>
                ))}
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s, si) => (
                <tr key={si} className="border-t border-border">
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
                        max={10}
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
          Notas de 0 a 10 (step 0,5). O assistente calcula o score ponderado e classifica cada fornecedor na faixa correspondente.
        </p>
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
