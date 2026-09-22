'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Plus, Workflow } from 'lucide-react';
import { toast } from 'sonner';

import { FLUXO_STAGES, getStage } from '@/lib/fluxo/stages';
import type { FluxoProcesso } from '@/lib/fluxo/types';

// Lista de processos + abertura de um novo. A entrada do fluxo é a
// requisição em texto livre — é o que a etapa 1 padroniza.

function etapaLabel(processo: FluxoProcesso) {
  const stage = getStage(processo.etapa_atual);
  return stage ? `Etapa ${stage.num} · ${stage.label}` : processo.etapa_atual;
}

function concluidas(processo: FluxoProcesso) {
  return FLUXO_STAGES.filter((s) => !!processo.contexto?.[s.id]).length;
}

export function FluxoRoot({ processosIniciais }: { processosIniciais: FluxoProcesso[] }) {
  const router = useRouter();

  const [processos] = useState(processosIniciais);
  const [abrindo, setAbrindo] = useState(processosIniciais.length === 0);
  const [titulo, setTitulo] = useState('');
  const [requisicao, setRequisicao] = useState('');
  const [busy, setBusy] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (requisicao.trim().length < 10) {
      toast.error('Descreva a necessidade da compra com um pouco mais de detalhe.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/fluxo/processos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, requisicao }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        processo?: FluxoProcesso;
        message?: string;
      };

      if (!res.ok || !data.processo) {
        toast.error(data.message ?? 'Não foi possível abrir o processo.');
        return;
      }

      router.push(`/fluxo/${data.processo.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-brand">
          <Workflow className="h-5 w-5" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Fluxo automatizado de compras
          </span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Da solicitação à chegada do produto</h1>

        <p className="text-sm text-muted-foreground max-w-2xl">
          Oito etapas encadeadas. A IA executa cada uma e para para você decidir:{' '}
          <strong className="text-foreground">SIGA</strong> avança,{' '}
          <strong className="text-foreground">AJUSTAR</strong> devolve a etapa para ser refeita.
          Nada anda sem a sua decisão.
        </p>
      </header>

      {/* Trilha das 8 etapas, só como mapa do processo */}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {FLUXO_STAGES.map((s) => (
          <li
            key={s.id}
            className={`rounded-xl border p-3 ${
              s.trilha === 's2c'
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-brand/30 bg-brand/5'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Etapa {s.num}
            </div>
            <div className="mt-1 text-xs font-medium leading-tight">{s.label}</div>
          </li>
        ))}
      </ol>

      {!abrindo && (
        <button
          type="button"
          onClick={() => setAbrindo(true)}
          className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black h-11 px-5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nova compra
        </button>
      )}

      {abrindo && (
        <form
          onSubmit={criar}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold">Abrir um processo de compra</h2>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="titulo">
              Título (opcional)
            </label>
            <input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Compra de notebooks — TI"
              className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="req">
              Qual é a necessidade?
            </label>
            <textarea
              id="req"
              value={requisicao}
              onChange={(e) => setRequisicao(e.target.value)}
              rows={6}
              placeholder="Descreva o item ou serviço, quantidade, prazo desejado, centro de custo, orçamento e a justificativa. Pode colar o e-mail da área solicitante."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black h-10 px-5 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Abrir processo
            </button>

            {processos.length > 0 && (
              <button
                type="button"
                onClick={() => setAbrindo(false)}
                className="rounded-full border border-border h-10 px-5 text-sm text-muted-foreground hover:bg-accent"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {processos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Seus processos</h2>

          <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
            {processos.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/fluxo/${p.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent transition-colors"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.status === 'concluido' ? 'Concluído' : etapaLabel(p)} ·{' '}
                      {concluidas(p)} de {FLUXO_STAGES.length} etapas aprovadas
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
