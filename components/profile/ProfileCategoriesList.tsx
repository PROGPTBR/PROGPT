'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  FolderOpen,
  Loader2,
  Plus,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

// Sub-projeto 34 follow-up — listar Perfis da Categoria cadastrados
// pelo usuário direto na página /profile. Cada item linka pro detalhe
// (/assistants/runs/[id]) onde o user pode revisar/refinar/baixar o
// documento, ou pra /assistants/profile pra criar um novo.

type ProfileRun = {
  id: string;
  params: {
    nomeCategoria?: string;
    subSegmentos?: string[];
    prioridadeEstrategica?: string;
  };
  status: 'running' | 'done' | 'error';
  created_at: string;
  error_message: string | null;
};

const PRIORIDADE_LABEL: Record<string, string> = {
  custo: 'Custo',
  qualidade: 'Qualidade',
  inovacao: 'Inovação',
  sustentabilidade: 'Sustentabilidade',
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ProfileCategoriesList() {
  const [runs, setRuns] = useState<ProfileRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assistants/runs?limit=50&type=profile', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { runs: ProfileRun[] };
      setRuns(data.runs ?? []);
    } catch (err) {
      toast.error('Falha ao listar categorias', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 p-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando…
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-gray-400">
        <p className="mb-3">Você ainda não cadastrou nenhuma categoria.</p>
        <Link
          href="/assistants/profile"
          className="inline-flex items-center gap-1.5 text-xs rounded-full border border-brand/40 bg-brand/10 hover:bg-brand/15 text-brand px-3 py-1.5 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Cadastrar primeira categoria
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {runs.map((r) => {
          const isDone = r.status === 'done';
          const hasError = r.status === 'error';
          const sub = r.params.subSegmentos ?? [];
          const prio = r.params.prioridadeEstrategica;
          const subPreview = sub.slice(0, 3).join(', ');
          return (
            <li
              key={r.id}
              className="rounded-xl border border-white/5 bg-[#141414] hover:bg-[#181818] hover:border-white/10 transition-all duration-300"
            >
              <Link
                href={`/assistants/runs/${r.id}`}
                className="flex items-start justify-between gap-3 p-4"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-brand">
                    <FolderOpen className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white line-clamp-1">
                      {r.params.nomeCategoria || '(sem nome)'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500 line-clamp-1">
                      {fmtDate(r.created_at)}
                      {sub.length > 0 && (
                        <>
                          {' · '}
                          {subPreview}
                          {sub.length > 3 ? `… (+${sub.length - 3})` : ''}
                        </>
                      )}
                      {prio && PRIORIDADE_LABEL[prio] && (
                        <>
                          {' · '}
                          prioridade: {PRIORIDADE_LABEL[prio]}
                        </>
                      )}
                    </div>
                    {hasError && r.error_message && (
                      <div className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                        <AlertCircle
                          className="h-3 w-3 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <span className="line-clamp-1">{r.error_message}</span>
                      </div>
                    )}
                    {!isDone && !hasError && (
                      <div className="mt-1 text-[11px] text-amber-400 flex items-center gap-1">
                        <Loader2
                          className="h-3 w-3 flex-shrink-0 animate-spin"
                          aria-hidden="true"
                        />
                        Gerando…
                      </div>
                    )}
                  </div>
                </div>
                <ExternalLink
                  className="flex-shrink-0 h-3.5 w-3.5 text-gray-500"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href="/assistants/profile"
        className="inline-flex items-center gap-1.5 text-xs rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-3 py-1.5 transition-all"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Nova categoria
      </Link>
    </div>
  );
}
