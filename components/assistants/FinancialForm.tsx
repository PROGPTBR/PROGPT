'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FinancialIndicators } from '@/lib/assistants/types';
import { calculateFinancialScore } from '@/lib/assistants/financial';
import { FINANCIAL_EXAMPLES } from '@/lib/assistants/examples';

// Sub-projeto 30 — Form para análise financeira de fornecedor.
//
// Dois caminhos:
//   1. Upload PDF (Balanço + DRE) → /api/assistants/financial/extract →
//      preenche os 12 campos. User revisa e ajusta antes de submeter.
//   2. Entrada manual: user preenche os campos diretamente.
//
// O scoring acontece server-side, mas mostramos um preview ao vivo do
// score determinístico (mesma fn) à medida que o user preenche os 4
// pilares — ajuda a calibrar antes de gerar a análise completa.

export type FinancialFormValues = {
  templateId: string;
  supplierName: string;
  cnpj: string;
  referenceYear: string;
  observacoes: string;
  indicators: FinancialIndicators;
  perfilId?: string;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
};

const INDICATOR_FIELDS: Array<{
  key: keyof FinancialIndicators;
  label: string;
  suffix: string;
  hint?: string;
  pillar?: 'liquidity' | 'debt' | 'margin' | 'roe';
}> = [
  { key: 'receitaLiquida', label: 'Receita Líquida', suffix: 'R$ MM' },
  { key: 'ebitda', label: 'EBITDA', suffix: 'R$ MM' },
  { key: 'lucroLiquido', label: 'Lucro Líquido', suffix: 'R$ MM' },
  { key: 'margemLiquidaPct', label: 'Margem Líquida', suffix: '%' },
  {
    key: 'margemEbitdaPct',
    label: 'Margem EBITDA',
    suffix: '%',
    hint: 'Pilar 3 (peso 20%)',
    pillar: 'margin',
  },
  {
    key: 'dividaLiquidaEbitda',
    label: 'Dívida Líquida / EBITDA',
    suffix: 'x',
    hint: 'Pilar 2 (peso 30%)',
    pillar: 'debt',
  },
  {
    key: 'liquidezCorrente',
    label: 'Liquidez Corrente',
    suffix: '',
    hint: 'Pilar 1 (peso 30%)',
    pillar: 'liquidity',
  },
  { key: 'patrimonioLiquido', label: 'Patrimônio Líquido', suffix: 'R$ MM' },
  {
    key: 'roePct',
    label: 'ROE',
    suffix: '%',
    hint: 'Pilar 4 (peso 20%)',
    pillar: 'roe',
  },
  { key: 'roicPct', label: 'ROIC', suffix: '%' },
  { key: 'endividamentoGeralPct', label: 'Endividamento Geral', suffix: '%' },
  {
    key: 'fluxoCaixaOperacional',
    label: 'Fluxo de Caixa Operacional',
    suffix: 'R$ MM',
  },
];

export function FinancialForm({
  onSubmit,
}: {
  onSubmit: (v: FinancialFormValues) => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [referenceYear, setReferenceYear] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [indicators, setIndicators] = useState<FinancialIndicators>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [perfilId] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/assistants/templates?type=financial');
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
    const ex = FINANCIAL_EXAMPLES[0];
    if (!ex) return;
    const p = ex.params;
    setSupplierName(p.supplierName);
    setCnpj(p.cnpj ?? '');
    setReferenceYear(p.referenceYear ?? '');
    setObservacoes(p.observacoes ?? '');
    setIndicators(p.indicators);
    toast.success('Exemplo carregado — ajuste e gere');
  }

  function setField(key: keyof FinancialIndicators, raw: string) {
    setIndicators((prev) => {
      const next = { ...prev };
      if (raw.trim() === '') {
        delete next[key];
      } else {
        // Aceita vírgula brasileira (1.234,56) — converte para 1234.56.
        const cleaned = raw.replace(/\./g, '').replace(/,/g, '.');
        const num = Number(cleaned);
        if (Number.isFinite(num)) next[key] = num;
      }
      return next;
    });
  }

  function displayValue(key: keyof FinancialIndicators): string {
    const v = indicators[key];
    if (v === undefined || v === null || !Number.isFinite(v)) return '';
    return String(v);
  }

  async function handlePdfUpload(file: File) {
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/assistants/financial/extract', {
        method: 'POST',
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        max_bytes?: number;
        indicators?: FinancialIndicators;
        detectedYear?: string;
        detectedCnpj?: string;
        notes?: string;
      };
      if (!res.ok || data.error) {
        const err = data.error ?? 'unknown';
        if (err === 'unsupported_mime') {
          toast.error('Apenas PDF é aceito.');
        } else if (err === 'file_too_large') {
          toast.error('PDF acima de 15 MB.', {
            description: 'Comprima ou recorte páginas irrelevantes.',
          });
        } else if (err === 'rate_limited') {
          toast.error('Limite atingido. Tente novamente em 1 min.');
        } else {
          toast.error('Falha ao extrair indicadores', {
            description: data.message ?? `status ${res.status}`,
          });
        }
        return;
      }
      const ext = data.indicators ?? {};
      setIndicators(ext);
      if (data.detectedYear && !referenceYear) setReferenceYear(data.detectedYear);
      if (data.detectedCnpj && !cnpj) setCnpj(data.detectedCnpj);
      const filled = Object.keys(ext).filter(
        (k) =>
          (ext as Record<string, unknown>)[k] !== undefined &&
          (ext as Record<string, unknown>)[k] !== null,
      ).length;
      toast.success(`${filled} indicador(es) preenchido(s) automaticamente.`, {
        description: data.notes ? data.notes : 'Revise antes de gerar a análise.',
      });
    } catch (err) {
      toast.error('Falha no upload', { description: String(err) });
    } finally {
      setExtracting(false);
    }
  }

  const livePreview = useMemo(
    () => calculateFinancialScore(indicators),
    [indicators],
  );

  function valid(): boolean {
    return templateId.length > 0 && supplierName.trim().length >= 2;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid()) return;
    onSubmit({
      templateId,
      supplierName: supplierName.trim(),
      cnpj: cnpj.trim(),
      referenceYear: referenceYear.trim(),
      observacoes: observacoes.trim(),
      indicators,
      perfilId,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-md border border-border bg-card p-6 max-w-4xl"
    >
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={loadExample}>
          Carregar exemplo
        </Button>
      </div>
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
            Fornecedor (nome / razão social){' '}
            <span className="text-destructive">*</span>
          </label>
          <Input
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Ex: Embalagens Acme Indústria S.A."
            maxLength={200}
          />
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">CNPJ</label>
          <Input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="XX.XXX.XXX/0001-XX"
            maxLength={32}
          />
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">Ano de referência</label>
          <Input
            value={referenceYear}
            onChange={(e) => setReferenceYear(e.target.value)}
            placeholder="Ex: 2024, 2025/2024"
            maxLength={20}
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-medium block mb-1">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Contexto: relação atual, volume estimado, restrições conhecidas…"
            className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[70px] focus:outline-none focus:ring-1 focus:ring-ring"
            maxLength={2000}
          />
        </div>
      </div>

      {/* ── PDF upload ──────────────────────────────────────────────── */}
      <div className="rounded-md border border-dashed border-border bg-background/40 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <h3 className="text-sm font-semibold">
              Atalho: extrair do Balanço Patrimonial / DRE (PDF)
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Faça upload do PDF e o sistema extrai os 12 indicadores
              automaticamente via IA multimodal (~30-90s). Você revisa
              antes de gerar a análise final. Até 15 MB.
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void handlePdfUpload(f);
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
                  Enviar PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 12 indicators grid ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-end justify-between flex-wrap gap-2 pt-2 border-t border-border">
          <div>
            <h2 className="text-sm font-semibold">12 indicadores financeiros</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Padrão BR: vírgula como separador decimal. Os 4 pilares destacados
              entram no cálculo do score; os outros 8 enriquecem a análise.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Score preview
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {livePreview.score.toFixed(1)}
              <span className="text-xs text-muted-foreground ml-1">/100</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-primary">
              {livePreview.rating}
              {livePreview.incomplete ? ' · pilares ausentes' : ''}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {INDICATOR_FIELDS.map((f) => {
            const isPillar = !!f.pillar;
            return (
              <div
                key={f.key}
                className={
                  isPillar
                    ? 'rounded-md border-2 border-primary/30 bg-primary/5 p-2'
                    : 'rounded-md border border-border p-2'
                }
              >
                <label className="text-[11px] font-medium block mb-1">
                  {f.label}
                  {f.suffix ? (
                    <span className="text-muted-foreground"> ({f.suffix})</span>
                  ) : null}
                  {f.hint ? (
                    <span className="ml-1 text-[9px] text-primary uppercase tracking-wider">
                      · {f.hint}
                    </span>
                  ) : null}
                </label>
                <Input
                  value={displayValue(f.key)}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder="—"
                  inputMode="decimal"
                  className="h-8 text-sm tabular-nums"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-2 border-t border-border flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-muted-foreground">
          Score 0-100 calculado deterministicamente. LLM gera apenas a narrativa
          + recomendações.
        </p>
        <Button type="submit" disabled={!valid()}>
          Gerar análise financeira
        </Button>
      </div>
    </form>
  );
}
