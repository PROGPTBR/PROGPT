'use client';

import { Trash2, Plus, ClipboardPaste } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Sub-projeto 27 — Editor de tabela para itens da análise Kraljic.
//
// Cada linha = 1 item. Score 1-4 nos 7 sub-critérios + spend numérico.
// Spend score (Impacto) é derivado server-side, não pontuado aqui.

export type ItemDraft = {
  name: string;
  segment: string;
  category: string;
  spendMM: string; // string for input, parsed to number on submit
  criticality: number; // 1-4
  technicalSpec: number;
  customerValue: number;
  marketStructure: number;
  marketRivalry: number;
  supplierPower: number;
  supplierSwitching: number;
};

export const EMPTY_ITEM: ItemDraft = {
  name: '',
  segment: '',
  category: '',
  spendMM: '',
  criticality: 1,
  technicalSpec: 1,
  customerValue: 1,
  marketStructure: 1,
  marketRivalry: 1,
  supplierPower: 1,
  supplierSwitching: 1,
};

const SCORE_OPTIONS = [1, 2, 3, 4] as const;

type Props = {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
};

// Tab-separated columns expected when pasting (Excel/Sheets row copy):
// name [tab] segment [tab] category [tab] spendMM [tab] criticality [tab]
// technicalSpec [tab] customerValue [tab] marketStructure [tab] marketRivalry
// [tab] supplierPower [tab] supplierSwitching
function parsePasted(text: string): ItemDraft[] {
  const rows = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: ItemDraft[] = [];
  for (const r of rows) {
    const parts = r.split('\t');
    if (parts.length < 4) continue; // need at least name + 3 cols to be useful
    const num = (s: string | undefined, fallback = 1) => {
      const n = Number((s ?? '').trim().replace(',', '.'));
      return Number.isFinite(n) ? n : fallback;
    };
    const clampScore = (s: string | undefined) => {
      const n = num(s, 1);
      if (!Number.isInteger(n) || n < 1 || n > 4) return 1;
      return n;
    };
    out.push({
      name: parts[0]?.trim() ?? '',
      segment: parts[1]?.trim() ?? '',
      category: parts[2]?.trim() ?? '',
      spendMM: parts[3]?.trim() ?? '',
      criticality: clampScore(parts[4]),
      technicalSpec: clampScore(parts[5]),
      customerValue: clampScore(parts[6]),
      marketStructure: clampScore(parts[7]),
      marketRivalry: clampScore(parts[8]),
      supplierPower: clampScore(parts[9]),
      supplierSwitching: clampScore(parts[10]),
    });
  }
  return out.filter((it) => it.name.length > 0);
}

export function KraljicItemTable({ items, onChange }: Props) {
  function update(i: number, patch: Partial<ItemDraft>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addRow() {
    onChange([...items, { ...EMPTY_ITEM }]);
  }
  function removeRow(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parsePasted(text);
      if (parsed.length === 0) {
        toast.error('Nada reconhecido', {
          description: 'Cole linhas no formato TSV (Tab-separated): nome, segmento, categoria, spend, scores…',
        });
        return;
      }
      onChange([...items.filter((it) => it.name.trim().length > 0), ...parsed]);
      toast.success(`${parsed.length} item(ns) adicionado(s)`);
    } catch {
      toast.error('Falha ao ler clipboard');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {items.length} item{items.length === 1 ? '' : 's'} · scores 1-4 (1=baixo, 4=alto)
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={pasteFromClipboard}>
            <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
            Colar TSV
          </Button>
          <Button type="button" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar item
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-2 font-medium">Item</th>
              <th className="text-left p-2 font-medium">Segmento</th>
              <th className="text-left p-2 font-medium">Categoria</th>
              <th className="text-right p-2 font-medium whitespace-nowrap">Spend (R$ MM)</th>
              <th className="p-2 font-medium whitespace-nowrap" title="Nível de Criticidade">Crit.</th>
              <th className="p-2 font-medium" title="Especificações Técnicas">Esp.</th>
              <th className="p-2 font-medium" title="Valor Percebido pelo Cliente">Vlr.</th>
              <th className="p-2 font-medium" title="Estrutura do Mercado">Estr.</th>
              <th className="p-2 font-medium" title="Rivalidade do Mercado">Riv.</th>
              <th className="p-2 font-medium" title="Poder de Barganha do Fornecedor">Pdr.</th>
              <th className="p-2 font-medium" title="Substituição de Fornecedor">Sub.</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-border">
                <td className="p-1">
                  <input
                    value={it.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    placeholder="Ex: Matéria-Prima 1"
                    className="w-full bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring"
                    maxLength={120}
                  />
                </td>
                <td className="p-1">
                  <input
                    value={it.segment}
                    onChange={(e) => update(i, { segment: e.target.value })}
                    placeholder="(D)/(I)"
                    className="w-full bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring"
                    maxLength={120}
                  />
                </td>
                <td className="p-1">
                  <input
                    value={it.category}
                    onChange={(e) => update(i, { category: e.target.value })}
                    placeholder="Categoria"
                    className="w-full bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring"
                    maxLength={120}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={it.spendMM}
                    onChange={(e) => update(i, { spendMM: e.target.value })}
                    placeholder="0,00"
                    className="w-24 text-right bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-input focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                    min={0}
                  />
                </td>
                {(
                  [
                    'criticality',
                    'technicalSpec',
                    'customerValue',
                    'marketStructure',
                    'marketRivalry',
                    'supplierPower',
                    'supplierSwitching',
                  ] as const
                ).map((field) => (
                  <td key={field} className="p-1">
                    <select
                      value={it[field]}
                      onChange={(e) => update(i, { [field]: Number(e.target.value) } as Partial<ItemDraft>)}
                      className="w-12 bg-background px-1.5 py-1 rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                    >
                      {SCORE_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                ))}
                <td className="p-1">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label="Remover linha"
                    className="text-muted-foreground hover:text-destructive"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center text-sm text-muted-foreground p-6">
                  Nenhum item. Clique &quot;Adicionar item&quot; ou &quot;Colar TSV&quot; para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Crit. = Criticidade · Esp. = Especificações Técnicas · Vlr. = Valor Percebido Cliente · Estr. = Estrutura do Mercado · Riv. = Rivalidade · Pdr. = Poder Barganha Fornecedor · Sub. = Substituição. Score de spend é derivado automaticamente do percentil do portfólio.
      </p>
    </div>
  );
}
