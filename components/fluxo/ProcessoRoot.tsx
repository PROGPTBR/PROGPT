'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  Pencil,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';

import { FLUXO_STAGES, getStage } from '@/lib/fluxo/stages';
import type { FluxoEtapa, FluxoProcesso } from '@/lib/fluxo/types';

// O tabuleiro do processo: trilha das 8 etapas + o card da etapa atual com o
// que a IA executou e os dois botões de decisão. É a tela que materializa a
// regra do processo — a IA propõe, a pessoa decide.

type Props = {
  processoInicial: FluxoProcesso;
  etapasIniciais: FluxoEtapa[];
};

export function ProcessoRoot({ processoInicial, etapasIniciais }: Props) {
  const [processo, setProcesso] = useState(processoInicial);
  const [etapas, setEtapas] = useState(etapasIniciais);
  const [entrada, setEntrada] = useState('');
  const [ajuste, setAjuste] = useState('');
  const [pedindoAjuste, setPedindoAjuste] = useState(false);
  const [busy, setBusy] = useState<null | 'run' | 'siga' | 'ajustar'>(null);

  const stage = getStage(processo.etapa_atual);
  const concluido = processo.status === 'concluido';

  const pendente = useMemo(
    () => etapas.find((e) => e.etapa === processo.etapa_atual && e.decisao === 'pendente') ?? null,
    [etapas, processo.etapa_atual],
  );

  const historico = useMemo(
    () => etapas.filter((e) => e.decisao !== 'pendente').reverse(),
    [etapas],
  );

  async function recarregar() {
    const res = await fetch(`/api/fluxo/processos/${processo.id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { processo: FluxoProcesso; etapas: FluxoEtapa[] };
    setProcesso(data.processo);
    setEtapas(data.etapas);
  }

  async function rodar() {
    if (busy) return;
    setBusy('run');
    try {
      const res = await fetch(`/api/fluxo/processos/${processo.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entrada }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };

      if (!res.ok) {
        toast.error(data.message ?? 'Não foi possível executar a etapa.');
        return;
      }

      setEntrada('');
      await recarregar();
    } finally {
      setBusy(null);
    }
  }

  async function decidir(decisao: 'siga' | 'ajustar') {
    if (busy) return;

    if (decisao === 'ajustar' && !ajuste.trim()) {
      toast.error('Diga o que precisa ser corrigido.');
      return;
    }

    setBusy(decisao);
    try {
      const res = await fetch(`/api/fluxo/processos/${processo.id}/decisao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, observacao: decisao === 'ajustar' ? ajuste : '' }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; concluido?: boolean };

      if (!res.ok) {
        toast.error(data.message ?? 'Não foi possível registrar a decisão.');
        return;
      }

      setAjuste('');
      setPedindoAjuste(false);
      await recarregar();

      toast.success(
        decisao === 'siga'
          ? data.concluido
            ? 'Processo concluído.'
            : 'Etapa aprovada. Próxima etapa liberada.'
          : 'Ajuste registrado. Rode a etapa de novo para a IA refazer.',
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/fluxo"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Processos
        </Link>

        {concluido && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Concluído
          </span>
        )}
      </div>

      <h1 className="text-xl font-semibold tracking-tight">{processo.titulo}</h1>

      {/* Trilha */}
      <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {FLUXO_STAGES.map((s) => {
          const aprovada = !!processo.contexto?.[s.id];
          const atual = s.id === processo.etapa_atual && !concluido;

          return (
            <li
              key={s.id}
              title={s.label}
              className={`rounded-lg border p-2 text-center ${
                aprovada
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : atual
                    ? 'border-brand bg-brand/10'
                    : 'border-border bg-muted/30 opacity-60'
              }`}
            >
              <div className="text-[10px] font-semibold text-muted-foreground">{s.num}</div>
              <div className="mt-0.5 text-[10px] leading-tight line-clamp-2">{s.label}</div>
              {aprovada && (
                <Check className="mx-auto mt-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      {/* Etapa atual */}
      {stage && !concluido && (
        <section className="rounded-2xl border-2 border-brand bg-card p-5 space-y-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand">
              Etapa {stage.num} de {FLUXO_STAGES.length} ·{' '}
              {stage.trilha === 's2c' ? 'S2C — da necessidade ao contrato' : 'P2P — da compra ao pagamento'}
            </div>
            <h2 className="mt-1 text-lg font-semibold">{stage.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{stage.automacao}.</p>
          </div>

          {!pendente && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="entrada">
                  {stage.entrada_do_usuario.rotulo}
                </label>
                <textarea
                  id="entrada"
                  rows={4}
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  placeholder={stage.entrada_do_usuario.placeholder}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <button
                type="button"
                onClick={rodar}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black h-10 px-5 text-sm font-semibold disabled:opacity-60"
              >
                {busy === 'run' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Play className="h-4 w-4" aria-hidden />
                )}
                Executar etapa
              </button>
            </div>
          )}

          {pendente && (
            <div className="space-y-4">
              <p className="text-sm">{pendente.saida.resumo}</p>

              {pendente.saida.campos.length > 0 && (
                <dl className="grid gap-2 sm:grid-cols-2">
                  {pendente.saida.campos.map((c, i) => (
                    <div key={i} className="rounded-lg bg-muted/40 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {c.rotulo}
                      </dt>
                      <dd className="text-sm">{c.valor}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {pendente.saida.itens.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {pendente.saida.itens.map((it, i) => (
                    <li key={i} className="px-3 py-2">
                      <div className="text-sm font-medium">{it.titulo}</div>
                      <div className="text-xs text-muted-foreground">{it.detalhe}</div>
                    </li>
                  ))}
                </ul>
              )}

              {pendente.saida.alertas.length > 0 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    Alertas
                  </div>
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {pendente.saida.alertas.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="mb-1 text-xs font-semibold">Confira antes de decidir</div>
                <ul className="list-disc pl-5 text-xs space-y-1 text-muted-foreground">
                  {(pendente.saida.pontos_de_revisao.length
                    ? pendente.saida.pontos_de_revisao
                    : [stage.revisaoDetalhe]
                  ).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Saída se você seguir
                </span>
                <div className="font-medium">{pendente.saida.saida}</div>
              </div>

              {pedindoAjuste && (
                <textarea
                  rows={3}
                  value={ajuste}
                  onChange={(e) => setAjuste(e.target.value)}
                  placeholder={`O que corrigir? (${stage.seAjustar})`}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => (pedindoAjuste ? decidir('ajustar') : setPedindoAjuste(true))}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 rounded-full bg-orange-500 text-white h-10 px-5 text-sm font-semibold hover:brightness-110 disabled:opacity-60"
                >
                  {busy === 'ajustar' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Pencil className="h-4 w-4" aria-hidden />
                  )}
                  AJUSTAR
                </button>

                <button
                  type="button"
                  onClick={() => decidir('siga')}
                  disabled={busy !== null || pedindoAjuste}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white h-10 px-6 text-sm font-semibold hover:brightness-110 disabled:opacity-60"
                >
                  {busy === 'siga' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  SIGA
                </button>

                <span className="self-center text-xs text-muted-foreground">
                  {stage.seSiga} · {stage.seAjustar}
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      {concluido && (
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <h2 className="text-sm font-semibold">Processo concluído</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            As 8 etapas foram executadas e aprovadas. O histórico abaixo guarda o que a IA propôs e
            o que você decidiu em cada uma.
          </p>
        </section>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Histórico</h2>

          {historico.map((e) => {
            const s = getStage(e.etapa);
            return (
              <details key={e.id} className="rounded-xl border border-border bg-card px-4 py-3">
                <summary className="cursor-pointer text-sm">
                  <span className="font-medium">
                    Etapa {s?.num} · {s?.label}
                  </span>{' '}
                  <span
                    className={
                      e.decisao === 'siga'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-orange-600 dark:text-orange-400'
                    }
                  >
                    — {e.decisao === 'siga' ? 'SIGA' : 'AJUSTAR'}
                  </span>
                  {e.rodada > 1 && (
                    <span className="text-xs text-muted-foreground"> (rodada {e.rodada})</span>
                  )}
                </summary>

                <div className="mt-2 space-y-2 text-sm">
                  <p>{e.saida.resumo}</p>
                  {e.observacao && (
                    <p className="rounded-lg bg-orange-500/10 px-3 py-2 text-xs">
                      <strong>Correção pedida:</strong> {e.observacao}
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </section>
      )}
    </div>
  );
}
