'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ItemDraft } from './KraljicItemTable';

// Sub-projeto 27 (v2) — Scoring helper.
//
// Modal pega uma descrição livre do item e devolve scores propostos
// para os 7 sub-critérios via /api/assistants/kraljic/suggest-scores.
// Usuário revisa, ajusta se quiser e aplica à linha alvo.

type Suggestion = {
  criticality: number;
  technicalSpec: number;
  customerValue: number;
  marketStructure: number;
  marketRivalry: number;
  supplierPower: number;
  supplierSwitching: number;
  rationale: string;
};

const CRITERION_FIELDS: Array<{
  key: keyof Omit<Suggestion, 'rationale'>;
  label: string;
  hint: string;
}> = [
  { key: 'criticality', label: 'Criticidade', hint: '1=baixa, 4=para a operação se faltar' },
  { key: 'technicalSpec', label: 'Esp. Técnicas', hint: '1=commodity, 4=engenharia customizada' },
  { key: 'customerValue', label: 'Valor Cliente', hint: '1=invisível, 4=diferenciador' },
  { key: 'marketStructure', label: 'Estrutura', hint: '1=pulverizado, 4=monopólio' },
  { key: 'marketRivalry', label: 'Rivalidade', hint: '1=alta concorrência, 4=cartel/coordenado' },
  { key: 'supplierPower', label: 'Poder Fornec.', hint: '1=baixo, 4=trava o comprador' },
  { key: 'supplierSwitching', label: 'Substituição', hint: '1=trivial, 4=lock-in' },
];

type Props = {
  open: boolean;
  rowIndex: number | null;
  current: ItemDraft | null;
  onClose: () => void;
  onApply: (rowIndex: number, patch: Partial<ItemDraft>) => void;
};

export function KraljicScoringAssistant({ open, rowIndex, current, onClose, onApply }: Props) {
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  // Repopulate from the target row whenever the modal (re)opens.
  useEffect(() => {
    if (open && current) {
      setItemName(current.name);
      setCategory(current.category);
      setDescription('');
      setSuggestion(null);
    }
  }, [open, current]);

  if (!open || rowIndex === null) return null;

  async function suggest() {
    if (description.trim().length < 20) {
      toast.error('Descreva o item com pelo menos 20 caracteres');
      return;
    }
    setSuggesting(true);
    try {
      const res = await fetch('/api/assistants/kraljic/suggest-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName, category, description }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `status ${res.status}`);
      }
      const data = (await res.json()) as Suggestion;
      setSuggestion(data);
    } catch (err) {
      toast.error('Falha ao sugerir scores', { description: String(err) });
    } finally {
      setSuggesting(false);
    }
  }

  function applyToRow() {
    if (!suggestion || rowIndex === null) return;
    onApply(rowIndex, {
      name: itemName || current?.name || '',
      category: category || current?.category || '',
      criticality: suggestion.criticality,
      technicalSpec: suggestion.technicalSpec,
      customerValue: suggestion.customerValue,
      marketStructure: suggestion.marketStructure,
      marketRivalry: suggestion.marketRivalry,
      supplierPower: suggestion.supplierPower,
      supplierSwitching: suggestion.supplierSwitching,
    });
    toast.success('Scores aplicados na linha');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Assistente de preenchimento
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={suggesting}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Descreva o item com mais contexto possível — mercado de fornecedores, criticidade na sua operação, especificações técnicas. O assistente propõe scores 1-4 para os 7 critérios.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Nome do item</label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Ex: Embalagens flexíveis"
              maxLength={120}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Categoria</label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Embalagens"
              maxLength={120}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">
            Descrição livre <span className="text-destructive">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Compramos cerca de 5 milhões de pallets/ano. Mercado tem ~3 fornecedores regionais grandes; o switch demoraria 6 meses por causa de homologação. Sem implicação técnica relevante. Falha aqui para a expedição."
            className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[120px] focus:outline-none focus:ring-1 focus:ring-ring"
            maxLength={4000}
          />
          <div className="text-[10px] text-muted-foreground text-right mt-0.5">
            {description.length}/4000 · mínimo 20
          </div>
        </div>

        {!suggestion && (
          <div className="flex justify-end">
            <Button onClick={suggest} disabled={suggesting || description.trim().length < 20}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {suggesting ? 'Analisando…' : 'Propor scores'}
            </Button>
          </div>
        )}

        {suggestion && (
          <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="text-xs font-medium text-primary flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              Scores propostos (ajuste se quiser antes de aplicar)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CRITERION_FIELDS.map((c) => (
                <div key={c.key} className="flex items-center gap-2 text-xs">
                  <div className="flex-1">
                    <div className="font-medium">{c.label}</div>
                    <div className="text-[10px] text-muted-foreground">{c.hint}</div>
                  </div>
                  <select
                    value={suggestion[c.key]}
                    onChange={(e) =>
                      setSuggestion((s) =>
                        s ? { ...s, [c.key]: Number(e.target.value) } : s,
                      )
                    }
                    className="w-14 bg-background px-1.5 py-1 rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="text-xs">
              <div className="font-medium mb-1">Rationale do assistente:</div>
              <p className="text-muted-foreground whitespace-pre-wrap">{suggestion.rationale}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSuggestion(null)}>
                Refazer
              </Button>
              <Button size="sm" onClick={applyToRow}>
                <Check className="h-3.5 w-3.5 mr-1" />
                Aplicar à linha
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
