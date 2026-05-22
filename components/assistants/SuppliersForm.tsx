'use client';

import { useState, type FormEvent } from 'react';
import { Search, Sparkles } from 'lucide-react';

const EXAMPLES = [
  'Quero fornecedores de embalagens flexíveis no Nordeste',
  'Fabricantes de produtos químicos em SP',
  'Transportadoras de carga seca nacional',
  'Indústrias têxteis em Minas Gerais',
  'Empresas de TI para outsourcing em Brasília',
];

type Props = {
  initialQuery?: string;
  onSubmit: (query: string) => void;
  isLoading: boolean;
};

export function SuppliersForm({ initialQuery, onSubmit, isLoading }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 3 || isLoading) return;
    onSubmit(trimmed);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 border border-brand/30 px-3 py-1 text-xs font-medium text-brand">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Passo 3 · Visão do Mercado Fornecedor
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Busca de Fornecedores <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Descreva o que você procura em linguagem natural — atividade, região,
          porte. A IA identifica o CNAE e busca empresas reais ativas na base
          da Receita Federal.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: Quero fornecedores de embalagens flexíveis no Nordeste"
            rows={3}
            className="w-full resize-none rounded-2xl bg-card border border-border px-5 py-4 text-base text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
            disabled={isLoading}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {query.length}/500 caracteres
          </div>
          <button
            type="submit"
            disabled={query.trim().length < 3 || isLoading}
            className="inline-flex items-center gap-2 rounded-full bg-brand text-black h-11 px-6 text-sm font-medium hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-300"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {isLoading ? 'Identificando…' : 'Buscar fornecedores'}
          </button>
        </div>
      </form>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Exemplos
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuery(ex)}
              disabled={isLoading}
              className="rounded-full border border-border bg-card hover:bg-accent hover:border-brand/30 px-3.5 h-8 text-xs text-foreground/80 hover:text-foreground transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
