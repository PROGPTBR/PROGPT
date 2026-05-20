'use client';

import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, ChevronDown, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

// Sub-projeto 34 — Pill acima do Composer que exibe / troca o Perfil da
// Categoria ativo no chat. Quando vazio: "📁 Sem categoria ▾". Quando
// ativo: "📁 Embalagens flexíveis ×". Click no nome abre dropdown com
// perfis recentes. Click no × limpa.
//
// A persistência (sessions.active_perfil_id) acontece no onFinish do
// /api/chat — chip só dispara o setter local; "aplica do próximo turno
// em diante" é a UX confirmada com o usuário.

type ProfileRun = {
  id: string;
  params: { nomeCategoria?: string };
  created_at: string;
};

type Props = {
  activePerfilId: string | null;
  onChange: (perfilId: string | null) => void;
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ActiveProfileChip({ activePerfilId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<ProfileRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeName, setActiveName] = useState<string | null>(null);

  // Fetch the list when the dropdown opens.
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

  // Resolve the name of the currently active profile so the chip can
  // show it. Fetched once on mount or when activePerfilId changes.
  useEffect(() => {
    if (!activePerfilId) {
      setActiveName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/assistants/runs/${activePerfilId}/details`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          if (!cancelled) setActiveName('(perfil não encontrado)');
          return;
        }
        const data = (await res.json()) as {
          params: { nomeCategoria?: string };
          assistant_type: string;
        };
        if (cancelled) return;
        if (data.assistant_type !== 'profile') {
          setActiveName('(não é um Perfil)');
          return;
        }
        setActiveName(data.params?.nomeCategoria ?? '(sem nome)');
      } catch {
        if (!cancelled) setActiveName('(falha ao carregar)');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activePerfilId]);

  const handlePick = (perfilId: string, name: string) => {
    onChange(perfilId);
    setActiveName(name);
    setOpen(false);
    toast.success(`Categoria ativada: ${name}`, {
      description: 'Vale para a próxima mensagem em diante.',
    });
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setActiveName(null);
    toast.info('Categoria removida', {
      description: 'Próximas mensagens voltam ao padrão.',
    });
  };

  return (
    <div className="relative px-4 pb-1 max-w-3xl mx-auto w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition-colors ${
          activePerfilId
            ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
            : 'border-border bg-background/40 text-muted-foreground hover:bg-background/60'
        }`}
        title={
          activePerfilId
            ? 'Categoria ativa — click pra trocar'
            : 'Selecionar Perfil da Categoria'
        }
      >
        <FolderOpen className="h-3 w-3" aria-hidden="true" />
        <span className="line-clamp-1 max-w-[16rem]">
          {activePerfilId
            ? activeName ?? 'Carregando…'
            : 'Sem categoria'}
        </span>
        {activePerfilId ? (
          <span
            onClick={handleClear}
            role="button"
            tabIndex={0}
            aria-label="Remover categoria"
            className="hover:text-destructive transition-colors -mr-0.5"
          >
            <X className="h-3 w-3" />
          </span>
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 left-4 w-80 rounded-md border border-border bg-popover shadow-lg p-2">
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
                    onClick={() =>
                      handlePick(r.id, r.params.nomeCategoria || '(sem nome)')
                    }
                    className={`w-full text-left rounded-sm hover:bg-accent px-3 py-2 transition-colors ${
                      r.id === activePerfilId ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="text-xs font-medium line-clamp-1">
                      {r.params.nomeCategoria || '(sem nome)'}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {fmtDate(r.created_at)}
                      {r.id === activePerfilId ? ' · ativo' : ''}
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
