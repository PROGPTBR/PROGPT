'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { UserCircle2, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProfileParams } from '@/lib/assistants/types';

// Sub-projeto 33 — Reusable picker mounted in every assistant Form.
//
// Lists the user's past Profile runs (assistant_type='profile' and
// status='done'). Click → fetch /api/assistants/runs/[id]/details →
// call onProfileSelected with the params. Caller decides how to map
// fields onto its own form state.

type ProfileRun = {
  id: string;
  params: { nomeCategoria?: string };
  created_at: string;
};

type Props = {
  onProfileSelected: (perfilId: string, params: ProfileParams) => void;
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function UseProfilePicker({ onProfileSelected }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<ProfileRun[]>([]);
  const [picking, setPicking] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        '/api/assistants/runs?limit=20&type=profile',
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { runs: ProfileRun[] };
      setRuns(data.runs ?? []);
    } catch (err) {
      toast.error('Falha ao listar Perfis', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && runs.length === 0 && !loading) {
      void fetchRuns();
    }
  }, [open, runs.length, loading, fetchRuns]);

  async function handlePick(runId: string) {
    setPicking(runId);
    try {
      const res = await fetch(`/api/assistants/runs/${runId}/details`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as {
        params: ProfileParams;
        assistant_type: string;
      };
      if (data.assistant_type !== 'profile') {
        toast.error('Run não é um Perfil');
        return;
      }
      onProfileSelected(runId, data.params);
      setOpen(false);
      toast.success('Form pré-preenchido a partir do Perfil');
    } catch (err) {
      toast.error('Falha ao carregar Perfil', { description: String(err) });
    } finally {
      setPicking(null);
    }
  }

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
      >
        <UserCircle2 className="h-3.5 w-3.5 mr-1.5" />
        Iniciar de um Perfil
        <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
      </Button>
      {open && (
        <div className="absolute z-20 mt-1 right-0 w-80 rounded-md border border-border bg-popover shadow-lg p-2">
          {loading && (
            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando…
            </div>
          )}
          {!loading && runs.length === 0 && (
            <div className="p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Você ainda não criou nenhum Perfil da Categoria.
              </p>
              <Link
                href="/assistants/profile"
                className="text-xs text-primary hover:text-primary/80 inline-flex items-center"
              >
                Criar Perfil →
              </Link>
            </div>
          )}
          {!loading && runs.length > 0 && (
            <ul className="max-h-72 overflow-y-auto">
              {runs.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={picking === r.id}
                    onClick={() => handlePick(r.id)}
                    className="w-full text-left rounded-sm hover:bg-accent px-3 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="text-xs font-medium line-clamp-1">
                      {r.params.nomeCategoria || '(sem nome)'}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {fmtDate(r.created_at)}
                      {picking === r.id ? ' · carregando…' : ''}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
