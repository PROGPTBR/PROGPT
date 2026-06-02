'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, BookmarkCheck, Download, Filter, Inbox } from 'lucide-react';
import type { GroupedSupplier, SearchResponse, UF } from '@/lib/suppliers/types';
import { SuppliersResultCard } from './SuppliersResultCard';

type Props = {
  response: SearchResponse;
  cnae: string;
  ufs: UF[];
  onBack: () => void;
  onExport: () => void;
  isExporting: boolean;
  onSave?: () => void;
  saved?: boolean;
};

type SizeFilter = 'all' | 'small_plus' | 'medium_plus';

const SIZE_LABEL: Record<SizeFilter, string> = {
  all: 'Todos',
  small_plus: 'EPP+',
  medium_plus: 'Médio/Grande',
};

function groupHasContact(g: GroupedSupplier): boolean {
  return g.units.some((u) => u.telefone || u.email);
}

function groupHasSize(g: GroupedSupplier, size: SizeFilter): boolean {
  if (size === 'all') return true;
  const matrizPorte =
    g.units.find((u) => u.cnpj.slice(8, 12) === '0001')?.porte ??
    g.units[0]!.porte;
  if (size === 'small_plus') return matrizPorte !== 'ME';
  if (size === 'medium_plus') return matrizPorte === 'DEMAIS';
  return true;
}

export function SuppliersResults({
  response,
  cnae,
  ufs,
  onBack,
  onExport,
  isExporting,
  onSave,
  saved,
}: Props) {
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all');
  const [contactOnly, setContactOnly] = useState(false);

  const filtered = useMemo(() => {
    return response.groups.filter((g) => {
      if (!groupHasSize(g, sizeFilter)) return false;
      if (contactOnly && !groupHasContact(g)) return false;
      return true;
    });
  }, [response.groups, sizeFilter, contactOnly]);

  const totalLabel =
    response.total >= 500 ? '500+' : response.total.toString();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Nova busca
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Fornecedores <span className="text-brand">.</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono text-foreground">{cnae}</span>
              {response.cnaeName && ` · ${response.cnaeName}`}
              {ufs.length > 0 && ` · ${ufs.join(', ')}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalLabel} {response.total === 1 ? 'empresa' : 'empresas'}
              {response.total >= 500
                ? ' (limitado a 500 — refine para ver mais)'
                : ''}
            </p>
          </div>
          {response.groups.length > 0 && (
            <div className="flex items-center gap-2">
              {onSave && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saved}
                  title={saved ? 'Busca salva' : 'Salvar esta busca em "Buscas recentes"'}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card hover:bg-accent hover:border-brand/30 text-foreground px-5 h-10 text-sm font-medium transition-all duration-300 active:scale-95 disabled:opacity-60"
                >
                  {saved ? (
                    <BookmarkCheck className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {saved ? 'Busca salva' : 'Salvar busca'}
                </button>
              )}
              <button
                type="button"
                onClick={onExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 hover:bg-brand/10 hover:border-brand/50 text-brand px-5 h-10 text-sm font-medium transition-all duration-300 active:scale-95 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {isExporting ? 'Gerando…' : 'Exportar CSV'}
              </button>
            </div>
          )}
        </div>
      </div>

      {response.groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3 w-3" aria-hidden="true" />
            Porte
          </div>
          <div className="flex flex-wrap gap-1">
            {(['all', 'small_plus', 'medium_plus'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSizeFilter(s)}
                className={`rounded-md px-2.5 h-7 text-xs font-medium transition-all duration-150 active:scale-95 ${
                  sizeFilter === s
                    ? 'bg-brand/10 border border-brand/30 text-brand'
                    : 'bg-background border border-border text-foreground/70 hover:bg-accent'
                }`}
              >
                {SIZE_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-border" />

          <label className="inline-flex items-center gap-2 text-xs text-foreground/80 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={contactOnly}
              onChange={(e) => setContactOnly(e.target.checked)}
              className="rounded border-border text-brand focus:ring-brand"
            />
            Com telefone ou email
          </label>

          <div className="ml-auto text-xs text-muted-foreground">
            Mostrando {filtered.length} de {response.groups.length}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 opacity-40" aria-hidden="true" />
          <p className="text-sm">
            {response.groups.length === 0
              ? 'Nenhum fornecedor encontrado para este CNAE + UFs.'
              : 'Nenhum fornecedor bate com os filtros.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <SuppliersResultCard key={g.cnpjBasico} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}
