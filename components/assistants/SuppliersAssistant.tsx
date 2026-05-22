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
import { SuppliersForm } from './SuppliersForm';
import { SuppliersConfirm } from './SuppliersConfirm';
import { SuppliersResults } from './SuppliersResults';

type Phase =
  | { kind: 'form' }
  | { kind: 'classifying' }
  | { kind: 'confirming'; classify: ClassifyResponse }
  | {
      kind: 'searching';
      classify: ClassifyResponse;
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

export function SuppliersAssistant() {
  const params = useSearchParams();
  const initialQuery = params.get('q') ?? '';
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [isExporting, setIsExporting] = useState(false);

  // Auto-submit if landing with ?q=...
  useEffect(() => {
    if (initialQuery && phase.kind === 'form') {
      void handleClassify(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClassify(query: string) {
    setPhase({ kind: 'classifying' });
    try {
      const res = await fetch('/api/suppliers/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as {
          retry_after_secs?: number;
        };
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

  async function handleSearch(params: {
    cnae: string;
    cnaeName: string;
    ufs: UF[];
  }) {
    const classify =
      phase.kind === 'confirming' ? phase.classify : null;
    if (!classify) return;
    setPhase({
      kind: 'searching',
      classify,
      cnae: params.cnae,
      cnaeName: params.cnaeName,
      ufs: params.ufs,
    });
    try {
      const res = await fetch('/api/suppliers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnae: params.cnae,
          ufs: params.ufs.length > 0 ? params.ufs : undefined,
          limit: 50,
        }),
      });
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as {
          retry_after_secs?: number;
        };
        toast.error(
          `Limite atingido. Tente em ${data.retry_after_secs ?? 60}s.`,
        );
        setPhase({ kind: 'confirming', classify });
        return;
      }
      if (!res.ok) {
        toast.error('Erro ao buscar. Tente de novo.');
        setPhase({ kind: 'confirming', classify });
        return;
      }
      const response = (await res.json()) as SearchResponse;
      setPhase({
        kind: 'done',
        response,
        cnae: params.cnae,
        cnaeName: response.cnaeName ?? params.cnaeName,
        ufs: params.ufs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro: ${msg}`);
      setPhase({ kind: 'confirming', classify });
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
      />
    );
  }

  return (
    <SuppliersForm
      initialQuery={initialQuery}
      onSubmit={handleClassify}
      isLoading={false}
    />
  );
}
