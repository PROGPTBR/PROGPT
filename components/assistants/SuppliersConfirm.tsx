'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, MapPin, Tag, X } from 'lucide-react';
import type {
  CnaeAlternative,
  CnaeInfo,
  ClassifyResponse,
  UF,
} from '@/lib/suppliers/types';
import { UF_LIST } from '@/lib/suppliers/types';
import { CnaeAutocomplete } from './CnaeAutocomplete';

type Props = {
  classify: ClassifyResponse;
  onBack: () => void;
  onConfirm: (params: { cnae: string; cnaeName: string; ufs: UF[] }) => void;
  isLoading: boolean;
};

export function SuppliersConfirm({
  classify,
  onBack,
  onConfirm,
  isLoading,
}: Props) {
  const [cnae, setCnae] = useState(classify.cnaeCode ?? '');
  const [cnaeName, setCnaeName] = useState(classify.cnaeName ?? '');
  const [ufs, setUfs] = useState<UF[]>(classify.states ?? []);

  function handleSelectCnae(info: CnaeInfo) {
    setCnae(info.code);
    setCnaeName(info.name);
  }

  function handleSelectAlternative(alt: CnaeAlternative) {
    setCnae(alt.code);
    setCnaeName(alt.name);
  }

  function toggleUf(uf: UF) {
    setUfs((prev) =>
      prev.includes(uf) ? prev.filter((x) => x !== uf) : [...prev, uf],
    );
  }

  function handleSubmit() {
    if (!cnae) return;
    onConfirm({ cnae, cnaeName, ufs });
  }

  const canSubmit = cnae.length > 0 && !isLoading;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Voltar
        </button>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Confirme o que vamos buscar <span className="text-brand">.</span>
        </h1>
        {classify.rationale && (
          <p className="text-sm text-muted-foreground">
            {classify.rationale}
          </p>
        )}
      </div>

      {/* CNAE selection */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Tag className="h-3.5 w-3.5" aria-hidden="true" />
          CNAE
        </div>

        {cnae ? (
          <div className="space-y-1.5">
            <div className="font-mono text-sm text-brand">{cnae}</div>
            <div className="text-base text-foreground">{cnaeName}</div>
            {classify.confidence > 0 && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Confiança: {(classify.confidence * 100).toFixed(0)}%
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">
            Nenhum CNAE selecionado — busque abaixo.
          </div>
        )}

        {classify.alternatives.length > 0 && (
          <div className="pt-2 border-t border-border space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Outras opções da IA
            </div>
            <div className="flex flex-wrap gap-1.5">
              {classify.alternatives.map((alt) => (
                <button
                  key={alt.code}
                  type="button"
                  onClick={() => handleSelectAlternative(alt)}
                  className={`rounded-full border px-3 h-7 text-xs transition-all duration-200 active:scale-95 ${
                    alt.code === cnae
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border bg-background hover:bg-accent text-foreground/80'
                  }`}
                  title={alt.name}
                >
                  <span className="font-mono">{alt.code}</span>
                  <span className="ml-1.5 hidden sm:inline">
                    {alt.name.length > 30 ? alt.name.slice(0, 30) + '…' : alt.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Buscar outro CNAE
          </div>
          <CnaeAutocomplete value={cnae} onSelect={handleSelectCnae} />
        </div>
      </div>

      {/* UFs selection */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Estados
          </div>
          {ufs.length > 0 && (
            <button
              type="button"
              onClick={() => setUfs([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar
            </button>
          )}
        </div>

        {ufs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ufs.map((uf) => (
              <button
                key={uf}
                type="button"
                onClick={() => toggleUf(uf)}
                className="inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand/30 px-3 h-7 text-xs font-medium text-brand hover:bg-brand/20 transition-colors"
              >
                {uf}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {ufs.length === 0 ? 'Sem filtro = busca nacional' : 'Adicionar/remover'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {UF_LIST.map((uf) => {
            const active = ufs.includes(uf);
            return (
              <button
                key={uf}
                type="button"
                onClick={() => toggleUf(uf)}
                className={`rounded-md border px-2.5 h-7 text-xs font-medium transition-all duration-150 active:scale-95 ${
                  active
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-background hover:bg-accent text-foreground/70'
                }`}
              >
                {uf}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-full bg-brand text-black h-11 px-6 text-sm font-medium hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-300"
        >
          {isLoading ? 'Buscando…' : 'Buscar fornecedores'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
