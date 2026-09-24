'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  Save,
  Target,
} from 'lucide-react';

import { toast } from 'sonner';

import type { FluxoPainel, SlaPorEtapa } from '@/lib/fluxo/metrics';
import { DIAS_PARA_ALERTA } from '@/lib/fluxo/metrics';
import { FLUXO_STAGES } from '@/lib/fluxo/stages';

// Painel de gestão dos processos de compra: onde as compras estão, quanto
// tempo levam e quais travaram. Gráficos em SVG na mão, como o resto do
// projeto — sem dependência nova.

function Kpi({
  rotulo,
  valor,
  sufixo,
  Icon,
  alerta,
}: {
  rotulo: string;
  valor: string | number;
  sufixo?: string;
  Icon: typeof Clock;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        alerta
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {rotulo}
      </div>
      <div className="mt-1.5 text-2xl font-semibold">
        {valor}
        {sufixo && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {sufixo}
          </span>
        )}
      </div>
    </div>
  );
}

export function PainelRoot() {
  const [dados, setDados] = useState<FluxoPainel | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Aba de metas: o cliente define o prazo aceitável de cada etapa. Sem meta
  // o painel mede, mas não julga — não existe SLA sem alvo.
  const [aba, setAba] = useState<'painel' | 'metas'>('painel');
  const [metas, setMetas] = useState<SlaPorEtapa>({});
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const [painel, sla] = await Promise.all([
      fetch('/api/fluxo/painel').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/fluxo/sla').then((r) => (r.ok ? r.json() : { slas: {} })),
    ]);
    if (painel) setDados(painel as FluxoPainel);
    setMetas((sla as { slas: SlaPorEtapa }).slas ?? {});
  }

  useEffect(() => {
    (async () => {
      try {
        await carregar();
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  async function salvarMetas() {
    if (salvando) return;
    setSalvando(true);
    try {
      const res = await fetch('/api/fluxo/sla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slas: metas }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };

      if (!res.ok) {
        toast.error(data.message ?? 'Não foi possível salvar as metas.');
        return;
      }

      await carregar();
      toast.success('Metas salvas. O painel já está medindo por elas.');
      setAba('painel');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  if (!dados) {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground">
        Não foi possível carregar o painel agora.
      </p>
    );
  }

  const maiorEtapa = Math.max(1, ...dados.etapas.map((e) => e.emAndamento));
  const vazio = dados.totalProcessos === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-8">
      <div className="space-y-1">
        <Link
          href="/fluxo"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Processos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Gestão dos processos de compra
        </h1>
        <p className="text-sm text-muted-foreground">
          Onde cada compra está, quanto tempo leva e o que travou.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {([['painel', 'Painel'], ['metas', 'Metas de SLA']] as const).map(
          ([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                aba === id
                  ? 'border-brand text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {rotulo}
            </button>
          ),
        )}
      </div>

      {aba === 'metas' && (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand" aria-hidden="true" />
            <h2 className="text-sm font-semibold">
              Prazo aceitável de cada etapa
            </h2>
          </div>

          <p className="text-xs text-muted-foreground">
            Defina em horas quanto cada etapa pode levar. O painel passa a
            mostrar quanto do processo fica dentro do prazo e avisa quando uma
            compra estoura. Deixe em 0 a etapa que você não quer acompanhar.
          </p>

          <div className="space-y-2">
            {FLUXO_STAGES.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <label
                  htmlFor={`meta-${s.id}`}
                  className="flex-1 text-sm truncate"
                >
                  {s.num}. {s.label}
                </label>

                <input
                  id={`meta-${s.id}`}
                  type="number"
                  min={0}
                  max={8760}
                  value={metas[s.id] ?? 0}
                  onChange={(e) =>
                    setMetas((prev) => ({
                      ...prev,
                      [s.id]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="w-24 rounded-lg border border-input bg-background px-3 h-9 text-sm text-right outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />

                <span className="w-24 shrink-0 text-xs text-muted-foreground">
                  {(metas[s.id] ?? 0) > 0
                    ? `= ${(((metas[s.id] ?? 0) / 24)).toFixed(1)} dias`
                    : 'sem meta'}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void salvarMetas()}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black h-10 px-5 text-sm font-semibold disabled:opacity-60"
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            Salvar metas
          </button>
        </section>
      )}

      {aba === 'painel' && (vazio ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Nenhuma compra aberta ainda. O painel se preenche sozinho conforme
            os processos andam.
          </p>
          <Link
            href="/fluxo"
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black h-10 px-5 text-sm font-semibold"
          >
            Abrir a primeira compra
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi rotulo="Em andamento" valor={dados.emAndamento} Icon={Clock} />
            <Kpi rotulo="Concluídas" valor={dados.concluidos} Icon={CheckCircle2} />
            <Kpi
              rotulo="Aguardando sua decisão"
              valor={dados.aguardandoDecisao}
              Icon={Hourglass}
              alerta={dados.aguardandoDecisao > 0}
            />
            <Kpi
              rotulo="Ciclo médio"
              valor={dados.cicloMedioDias ?? '—'}
              sufixo={dados.cicloMedioDias != null ? 'dias' : undefined}
              Icon={Clock}
            />
          </div>

          {/* Fora do prazo: medido contra a META, não contra dias corridos.
              Uma compra pode estourar o SLA em 4 horas e nunca aparecer na
              lista de "paradas há 3 dias". */}
          {dados.foraDoPrazo.length > 0 && (
            <section className="rounded-2xl border border-red-500/40 bg-red-500/5 p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
                <Target className="h-4 w-4" aria-hidden="true" />
                Fora do prazo que você definiu ({dados.foraDoPrazo.length})
              </div>

              <ul className="divide-y divide-red-500/20">
                {dados.foraDoPrazo.map((p) => (
                  <li key={p.id} className="py-2">
                    <Link
                      href={`/fluxo/${p.id}`}
                      className="flex items-center justify-between gap-3 hover:opacity-80"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.titulo}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.etapaLabel}
                          {p.aguardandoDecisao && ' · aguardando sua decisão'}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-red-600 dark:text-red-400">
                        {p.diasParado}d
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Compras paradas — o alerta que o comprador quer de manhã */}
          {dados.parados.length > 0 && (
            <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Paradas há {DIAS_PARA_ALERTA} dias ou mais ({dados.parados.length})
              </div>

              <ul className="divide-y divide-amber-500/20">
                {dados.parados.map((p) => (
                  <li key={p.id} className="py-2">
                    <Link
                      href={`/fluxo/${p.id}`}
                      className="flex items-center justify-between gap-3 hover:opacity-80"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.titulo}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.etapaLabel}
                          {p.aguardandoDecisao && ' · aguardando sua decisão'}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-amber-700 dark:text-amber-400">
                        {p.diasParado}d
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Funil + SLA por etapa */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Onde as compras estão</h2>

            <div className="space-y-2">
              {dados.etapas.map((e) => (
                <div key={e.etapa} className="flex items-center gap-3">
                  <div className="w-44 shrink-0 text-xs text-muted-foreground truncate">
                    {e.num}. {e.label}
                  </div>

                  <div className="flex-1 h-6 rounded bg-muted/40 overflow-hidden">
                    <div
                      className="h-full bg-brand/60 transition-all"
                      style={{ width: `${(e.emAndamento / maiorEtapa) * 100}%` }}
                    />
                  </div>

                  <div className="w-8 shrink-0 text-right text-sm font-medium">
                    {e.emAndamento}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Tempo e retrabalho por etapa</h2>
            <p className="text-xs text-muted-foreground">
              Tempo de resposta = da IA entregar a etapa até você decidir.
              Retrabalho = quantas vezes a etapa precisou ser refeita. A coluna
              &ldquo;No prazo&rdquo; só aparece nas etapas com meta definida.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Etapa</th>
                    <th className="py-2 px-3 font-medium text-right">Aprovadas</th>
                    <th className="py-2 px-3 font-medium text-right">Refeitas</th>
                    <th className="py-2 px-3 font-medium text-right">Retrabalho</th>
                    <th className="py-2 px-3 font-medium text-right">Tempo de resposta</th>
                    <th className="py-2 px-3 font-medium text-right">Meta</th>
                    <th className="py-2 pl-3 font-medium text-right">No prazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dados.etapas.map((e) => (
                    <tr key={e.etapa}>
                      <td className="py-2 pr-3">
                        {e.num}. {e.label}
                      </td>
                      <td className="py-2 px-3 text-right">{e.aprovacoes}</td>
                      <td className="py-2 px-3 text-right">{e.ajustes}</td>
                      <td
                        className={`py-2 px-3 text-right ${
                          e.retrabalhoPct >= 50
                            ? 'text-amber-600 dark:text-amber-400 font-medium'
                            : ''
                        }`}
                      >
                        {e.retrabalhoPct > 0 ? `${e.retrabalhoPct}%` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {e.horasAteDecisao != null ? `${e.horasAteDecisao} h` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground">
                        {e.metaHoras != null ? `${e.metaHoras} h` : '—'}
                      </td>
                      <td
                        className={`py-2 pl-3 text-right ${
                          e.dentroDaMetaPct != null && e.dentroDaMetaPct < 80
                            ? 'text-red-600 dark:text-red-400 font-medium'
                            : ''
                        }`}
                      >
                        {e.dentroDaMetaPct != null ? `${e.dentroDaMetaPct}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ))}
    </div>
  );
}
