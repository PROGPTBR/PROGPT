'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type {
  ClassifyResponse,
  SearchResponse,
  UF,
} from '@/lib/suppliers/types';
import {
  useSupplierSearches,
  type SavedSupplierSearch,
} from '@/hooks/useSupplierSearches';
import { SuppliersForm } from './SuppliersForm';
import { SuppliersConfirm } from './SuppliersConfirm';
import { SuppliersResults } from './SuppliersResults';

type Phase =
  | { kind: 'form' }
  | { kind: 'classifying' }
  | { kind: 'confirming'; classify: ClassifyResponse }
  | {
      kind: 'searching';
      // optional: a re-run from a saved search has no classify object
      classify?: ClassifyResponse;
      cnae: string;
      cnaeName: string;
      ufs: UF[];
    }
  | {
      kind: 'done';
      response: SearchResponse;
      cnae: string;
      cnaeName: string;
      ufs: UF[];
    };

function searchLabel(cnaeName: string, cnae: string, ufs: UF[]): string {
  const head = cnaeName.trim().length > 0 ? cnaeName.trim() : `CNAE ${cnae}`;
  return ufs.length > 0 ? `${head} — ${ufs.join(', ')}` : `${head} — Nacional`;
}

export function SuppliersAssistant() {
  const params = useSearchParams();
  const initialQuery = params.get('q') ?? '';
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [isExporting, setIsExporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const { searches, saveSearch, deleteSearch } = useSupplierSearches();

  // Auto-submit if landing with ?q=...
  useEffect(() => {
    if (initialQuery && phase.kind === 'form') {
      void handleClassify(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared search call. Toasts on rate-limit/error and returns null; caller
  // decides which phase to fall back to.
  async function doSearch(cnae: string, ufs: UF[]): Promise<SearchResponse | null> {
    try {
      const res = await fetch('/api/suppliers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnae, ufs: ufs.length > 0 ? ufs : undefined, limit: 50 }),
      });
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as { retry_after_secs?: number };
        toast.error(`Limite atingido. Tente em ${data.retry_after_secs ?? 60}s.`);
        return null;
      }
      if (!res.ok) {
        toast.error('Erro ao buscar. Tente de novo.');
        return null;
      }
      return (await res.json()) as SearchResponse;
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async function handleClassify(query: string) {
    setSaved(false);
    setPhase({ kind: 'classifying' });
    try {
      const res = await fetch('/api/suppliers/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as { retry_after_secs?: number };
        toast.error(
          `Limite de buscas atingido. Tente novamente em ${data.retry_after_secs ?? 60}s.`,
        );
        setPhase({ kind: 'form' });
        return;
      }
      if (!res.ok) {
        toast.error('Não consegui classificar agora. Tente de novo.');
        setPhase({ kind: 'form' });
        return;
      }
      const classify = (await res.json()) as ClassifyResponse;
      setPhase({ kind: 'confirming', classify });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro: ${msg}`);
      setPhase({ kind: 'form' });
    }
  }

  async function handleSearch(args: { cnae: string; cnaeName: string; ufs: UF[] }) {
    const classify = phase.kind === 'confirming' ? phase.classify : undefined;
    setSaved(false);
    setPhase({ kind: 'searching', classify, cnae: args.cnae, cnaeName: args.cnaeName, ufs: args.ufs });
    const response = await doSearch(args.cnae, args.ufs);
    if (!response) {
      setPhase(classify ? { kind: 'confirming', classify } : { kind: 'form' });
      return;
    }
    setPhase({
      kind: 'done',
      response,
      cnae: args.cnae,
      cnaeName: response.cnaeName ?? args.cnaeName,
      ufs: args.ufs,
    });
  }

  // Re-run a saved search directly (skip classify + confirm).
  async function handleRunSaved(s: SavedSupplierSearch) {
    const cnaeName = s.cnaeName ?? '';
    setSaved(true); // it's already in "Buscas recentes"
    setPhase({ kind: 'searching', cnae: s.cnae, cnaeName, ufs: s.ufs });
    const response = await doSearch(s.cnae, s.ufs);
    if (!response) {
      setPhase({ kind: 'form' });
      return;
    }
    setPhase({
      kind: 'done',
      response,
      cnae: s.cnae,
      cnaeName: response.cnaeName ?? cnaeName,
      ufs: s.ufs,
    });
  }

  async function handleSaveSearch() {
    if (phase.kind !== 'done') return;
    const label = searchLabel(phase.cnaeName, phase.cnae, phase.ufs);
    const result = await saveSearch({
      label,
      cnae: phase.cnae,
      cnaeName: phase.cnaeName || null,
      ufs: phase.ufs,
    });
    if (result) {
      setSaved(true);
      toast.success('Busca salva — aparece em "Buscas recentes"');
    } else {
      toast.error('Não consegui salvar a busca.');
    }
  }

  async function handleExport() {
    if (phase.kind !== 'done') return;
    setIsExporting(true);
    try {
      const res = await fetch('/api/suppliers/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnae: phase.cnae,
          ufs: phase.ufs.length > 0 ? phase.ufs : undefined,
        }),
      });
      if (!res.ok) {
        toast.error('Erro ao exportar.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match?.[1] ?? 'fornecedores.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  }

  if (phase.kind === 'classifying') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
        <p className="text-sm">Identificando CNAE…</p>
      </div>
    );
  }

  if (phase.kind === 'searching') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
        <p className="text-sm">Buscando fornecedores…</p>
      </div>
    );
  }

  if (phase.kind === 'confirming') {
    return (
      <SuppliersConfirm
        classify={phase.classify}
        onBack={() => setPhase({ kind: 'form' })}
        onConfirm={handleSearch}
        isLoading={false}
      />
    );
  }

  if (phase.kind === 'done') {
    return (
      <SuppliersResults
        response={phase.response}
        cnae={phase.cnae}
        ufs={phase.ufs}
        onBack={() => setPhase({ kind: 'form' })}
        onExport={handleExport}
        isExporting={isExporting}
        onSave={handleSaveSearch}
        saved={saved}
      />
    );
  }

  return (
    <SuppliersForm
      initialQuery={initialQuery}
      onSubmit={handleClassify}
      isLoading={false}
      savedSearches={searches}
      onRunSaved={handleRunSaved}
      onDeleteSaved={(id) => void deleteSearch(id)}
    />
  );
}
