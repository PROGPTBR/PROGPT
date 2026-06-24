'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PESQUISA_PRECOS_EXAMPLES } from '@/lib/assistants/examples';

// Sub-projeto 37 (fase 1) — form do assistente de Pesquisa de Preços.
// Lista de itens (descrição livre → CATMAT) + UF opcional pra recorte regional.
//
// Autocomplete CATMAT: ao digitar a descrição, um debounce consulta o catálogo
// do governo (Classe→PDM via LLM) e sugere os itens REAIS pra escolher. Quem
// escolhe trava o `codigoItem` e o backend pula a resolução cega — sem mismatch.

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;

type CatmatLock = {
  codigoItem?: number;
  descricaoItemCatalogo?: string;
  codigoClasse?: number;
  nomeClasse?: string;
  codigoPdm?: number;
  nomePdm?: string;
};

type ItemRow = { descricao: string; unidade: string; quantidade: string } & CatmatLock;

export type PesquisaPrecosFormValues = {
  templateId: string;
  titulo: string;
  uf: string;
  itens: ItemRow[];
  notas: string;
};

type Template = { id: string; name: string; description: string | null };

type Suggestion = { codigoItem: number; descricaoItem: string };
type SuggestResponse = {
  result: {
    codigoClasse: number;
    nomeClasse: string;
    codigoPdm: number;
    nomePdm: string;
  } | null;
  itens: Suggestion[];
};

const NO_LOCK: CatmatLock = {
  codigoItem: undefined,
  descricaoItemCatalogo: undefined,
  codigoClasse: undefined,
  nomeClasse: undefined,
  codigoPdm: undefined,
  nomePdm: undefined,
};

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
        <p className="text-[11px] text-muted-foreground mb-2">
          Digite a descrição e escolha o item no catálogo do governo que aparece
          abaixo — isso fixa o código CATMAT e evita preço de material errado. Sem
          escolher, o assistente tenta resolver sozinho.
        </p>
        <div className="space-y-2">
          {itens.map((item, idx) => (
            <CatmatItemRow
              key={idx}
              item={item}
              canRemove={itens.length > 1}
              onChange={(patch) => updateItem(idx, patch)}
              onRemove={() => removeItem(idx)}
            />
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

// ── Linha de item com autocomplete do catálogo CATMAT ────────────────────────

const SEARCH_DEBOUNCE_MS = 600;
const MIN_SEARCH_LEN = 3;

function CatmatItemRow({
  item,
  canRemove,
  onChange,
  onRemove,
}: {
  item: ItemRow;
  canRemove: boolean;
  onChange: (patch: Partial<ItemRow>) => void;
  onRemove: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const lastResult = useRef<SuggestResponse['result']>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locked = typeof item.codigoItem === 'number';

  const runSearch = useCallback(async (texto: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/assistants/pesquisa_precos/catalog-search?q=${encodeURIComponent(texto)}`,
        { signal: controller.signal },
      );
      if (!res.ok) {
        setSuggestions([]);
        lastResult.current = null;
      } else {
        const data = (await res.json()) as SuggestResponse;
        setSuggestions(data.itens ?? []);
        lastResult.current = data.result;
      }
      setSearched(true);
      setOpen(true);
    } catch {
      // abort ou rede — silencioso (o auto-resolve no submit é a rede de segurança)
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  // Debounce: dispara a busca quando a descrição muda e o item não está travado.
  useEffect(() => {
    if (locked) return;
    const texto = item.descricao.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (texto.length < MIN_SEARCH_LEN) {
      setSuggestions([]);
      setSearched(false);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => void runSearch(texto), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [item.descricao, locked, runSearch]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  function handleDescricaoChange(value: string) {
    // Editar a descrição invalida um item travado (o código não corresponde mais).
    onChange(locked ? { descricao: value, ...NO_LOCK } : { descricao: value });
  }

  function pick(s: Suggestion) {
    const r = lastResult.current;
    onChange({
      descricao: s.descricaoItem,
      codigoItem: s.codigoItem,
      descricaoItemCatalogo: s.descricaoItem,
      codigoClasse: r?.codigoClasse,
      nomeClasse: r?.nomeClasse,
      codigoPdm: r?.codigoPdm,
      nomePdm: r?.nomePdm,
    });
    setOpen(false);
    setSuggestions([]);
  }

  function clearLock() {
    onChange({ ...NO_LOCK });
    setSearched(false);
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="relative flex-1">
        <Input
          value={item.descricao}
          onChange={(e) => handleDescricaoChange(e.target.value)}
          onFocus={() => {
            if (!locked && suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            // atrasa pra permitir o clique numa sugestão antes de fechar
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          placeholder="Descrição do item (ex: açúcar refinado branco 1kg)"
          maxLength={300}
          className={locked ? 'pr-8 border-brand/50' : 'pr-8'}
        />

        {loading && !locked && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {locked && (
          <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-brand" />
        )}

        {/* Badge do item travado */}
        {locked && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-brand">
            <span className="font-medium">CATMAT {item.codigoItem}</span>
            <span className="text-muted-foreground truncate max-w-[280px]">
              {item.nomePdm ? `· ${item.nomePdm}` : ''}
            </span>
            <button
              type="button"
              onClick={clearLock}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Trocar item do catálogo"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Dropdown de sugestões */}
        {open && !locked && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-72 overflow-auto">
            {loading && suggestions.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando no catálogo do governo…
              </div>
            )}
            {!loading && searched && suggestions.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Sem itens do catálogo para esta descrição — o assistente vai tentar
                resolver sozinho ao gerar.
              </div>
            )}
            {suggestions.map((s) => (
              <button
                key={s.codigoItem}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-accent border-b border-border/50 last:border-b-0"
              >
                <span className="font-medium text-foreground">{s.codigoItem}</span>{' '}
                <span className="text-muted-foreground">— {s.descricaoItem}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Input
        value={item.quantidade}
        onChange={(e) => onChange({ quantidade: e.target.value })}
        placeholder="Qtd"
        inputMode="decimal"
        className="w-20"
      />
      <Input
        value={item.unidade}
        onChange={(e) => onChange({ unidade: e.target.value })}
        placeholder="Unid."
        maxLength={40}
        className="w-24"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label="Remover item"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
