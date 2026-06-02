'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type {
  PorterForce,
  PorterStatementScore,
} from '@/lib/assistants/types';
import { PORTER_FORCE_LABELS } from '@/lib/assistants/types';
import {
  PORTER_STATEMENTS_BY_FORCE,
  PORTER_FORCES_ORDERED,
  PORTER_INTENSITY_LABELS,
  intensityFromScore,
} from '@/lib/assistants/porter-statements';

// Sub-projeto 29 v2 — Quantitative Porter form (PG model).
//
// 35 canonical statements grouped by force. For each statement the user
// picks:
//   weight (0-3) — relevance to this sector (0 = N/A, 2 = default)
//   score  (1-5) — how true the statement is today (3 = default)
//
// Per-force live preview shows the running weighted average + intensity
// so the user has feedback as they fill. The server recomputes from the
// submitted statements (defense in depth + handles minor drift).

export type PorterFormValues = {
  templateId: string;
  categoria: string;
  segmento: string;
  escopo: string;
  observacoes: string;
  statements: PorterStatementScore[];
  perfilId?: string;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
};

const WEIGHT_LABELS: Record<number, string> = {
  0: '0 — não se aplica',
  1: '1 — menos relevante',
  2: '2 — relevante',
  3: '3 — mais relevante',
};

const SCORE_LABELS: Record<number, string> = {
  1: '1 — absolutamente falsa',
  2: '2 — falsa, com exceções',
  3: '3 — parcial',
  4: '4 — correta, com exceções',
  5: '5 — completamente correta',
};

// Default each statement to weight=2 (relevant) + score=3 (middle).
// The user adjusts only the standouts.
function initialStatements(): PorterStatementScore[] {
  return Object.values(PORTER_STATEMENTS_BY_FORCE)
    .flat()
    .map((s) => ({ id: s.id, weight: 2, score: 3 }));
}

export function PorterForm({
  onSubmit,
}: {
  onSubmit: (v: PorterFormValues) => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [categoria, setCategoria] = useState('');
  const [segmento, setSegmento] = useState('');
  const [escopo, setEscopo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [statements, setStatements] = useState<PorterStatementScore[]>(
    initialStatements,
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<PorterForce>>(new Set());
  const [perfilId] = useState<string | undefined>(undefined);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/assistants/templates?type=porter');
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

  function updateStatement(id: string, patch: Partial<PorterStatementScore>) {
    setStatements((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }

  function toggleForce(force: PorterForce) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(force)) next.delete(force);
      else next.add(force);
      return next;
    });
  }

  // Per-force running weighted average for the live preview.
  const forceAverages = useMemo(() => {
    const result: Partial<Record<PorterForce, number>> = {};
    for (const force of PORTER_FORCES_ORDERED) {
      const ids = PORTER_STATEMENTS_BY_FORCE[force].map((s) => s.id);
      const list = statements.filter((s) => ids.includes(s.id));
      const sumW = list.reduce((a, s) => a + s.weight, 0);
      const sumWS = list.reduce((a, s) => a + s.weight * s.score, 0);
      result[force] = sumW > 0 ? sumWS / sumW : 0;
    }
    return result;
  }, [statements]);

  const overallAvg = useMemo(() => {
    const valid = PORTER_FORCES_ORDERED.map((f) => forceAverages[f] ?? 0).filter(
      (v) => v > 0,
    );
    return valid.length > 0
      ? valid.reduce((a, v) => a + v, 0) / valid.length
      : 0;
  }, [forceAverages]);

  function valid(): boolean {
    return templateId.length > 0 && categoria.trim().length >= 2;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid()) return;
    onSubmit({
      templateId,
      categoria: categoria.trim(),
      segmento: segmento.trim(),
      escopo: escopo.trim(),
      observacoes: observacoes.trim(),
      statements,
      perfilId,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-md border border-border bg-card p-6 max-w-4xl"
    >
      {/* ── Top-level inputs ──────────────────────────────────────────── */}
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
            Categoria <span className="text-destructive">*</span>
          </label>
          <Input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ex: Embalagens flexíveis, Fretes inbound, SaaS de CRM"
            maxLength={200}
          />
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">Segmento</label>
          <Input
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            placeholder="Ex: Direto / Indireto / B2B / B2C"
            maxLength={200}
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-medium block mb-1">
            Escopo geográfico ou de mercado
          </label>
          <Input
            value={escopo}
            onChange={(e) => setEscopo(e.target.value)}
            placeholder="Ex: Brasil, América Latina, Global, Nicho farmacêutico"
            maxLength={300}
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-medium block mb-1">
            Observações adicionais
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Contexto da empresa, dados de share, restrições, fornecedores atuais…"
            className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring"
            maxLength={2000}
          />
        </div>
      </div>

      {/* ── Scoring sections ──────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-end justify-between flex-wrap gap-2 pt-2 border-t border-border">
          <div>
            <h2 className="text-sm font-semibold">Pontuação das 35 afirmações</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-2xl">
              Para cada afirmação, atribua <strong>peso</strong> (relevância dela
              neste setor) e <strong>nota</strong> (quão verdadeira ela é hoje).
              O sistema calcula a intensidade de cada força por média
              ponderada — o LLM produz só a narrativa.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Pressão geral
            </div>
            <div className="text-lg font-semibold">
              {overallAvg > 0 ? overallAvg.toFixed(2) : '—'}
              <span className="text-xs text-muted-foreground ml-2">
                {overallAvg > 0
                  ? PORTER_INTENSITY_LABELS[intensityFromScore(overallAvg)]
                  : ''}
              </span>
            </div>
          </div>
        </div>

        {PORTER_FORCES_ORDERED.map((force) => {
          const list = PORTER_STATEMENTS_BY_FORCE[force];
          const avg = forceAverages[force] ?? 0;
          const isCollapsed = collapsed.has(force);
          return (
            <section
              key={force}
              className="rounded-md border border-border bg-background"
            >
              <button
                type="button"
                onClick={() => toggleForce(force)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/40 transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold flex-1">
                  {PORTER_FORCE_LABELS[force]}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {list.length} afirmações
                </span>
                <span className="text-xs font-medium tabular-nums w-12 text-right">
                  {avg > 0 ? avg.toFixed(2) : '—'}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-primary w-12 text-right">
                  {avg > 0 ? PORTER_INTENSITY_LABELS[intensityFromScore(avg)] : ''}
                </span>
              </button>

              {!isCollapsed && (
                <ul className="divide-y divide-border">
                  {list.map((stmt) => {
                    const scoring = statements.find((s) => s.id === stmt.id);
                    if (!scoring) return null;
                    return (
                      <li
                        key={stmt.id}
                        className="px-3 py-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-center"
                      >
                        <div className="text-xs leading-relaxed">
                          <span className="text-muted-foreground tabular-nums mr-2">
                            {stmt.id}
                          </span>
                          {stmt.text}
                        </div>
                        <select
                          value={scoring.weight}
                          onChange={(e) =>
                            updateStatement(stmt.id, {
                              weight: Number(e.target.value),
                            })
                          }
                          className="rounded-md border border-input bg-background p-1.5 text-xs min-w-[180px]"
                          title="Peso (relevância da afirmação para o setor)"
                        >
                          {[0, 1, 2, 3].map((w) => (
                            <option key={w} value={w}>
                              {WEIGHT_LABELS[w]}
                            </option>
                          ))}
                        </select>
                        <select
                          value={scoring.score}
                          onChange={(e) =>
                            updateStatement(stmt.id, {
                              score: Number(e.target.value),
                            })
                          }
                          className="rounded-md border border-input bg-background p-1.5 text-xs min-w-[180px]"
                          title="Nota (quão verdadeira a afirmação é hoje)"
                        >
                          {[1, 2, 3, 4, 5].map((s) => (
                            <option key={s} value={s}>
                              {SCORE_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="pt-2 border-t border-border flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-muted-foreground">
          Defaults: peso = 2, nota = 3. Ajuste apenas o que destoa. Afirmações
          com peso 0 são descartadas do cálculo daquela força.
        </p>
        <Button type="submit" disabled={!valid()}>
          Gerar análise das 5 Forças
        </Button>
      </div>
    </form>
  );
}
