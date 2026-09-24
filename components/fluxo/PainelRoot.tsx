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
} from 'lucide-react';

import type { FluxoPainel } from '@/lib/fluxo/metrics';
import { DIAS_PARA_ALERTA } from '@/lib/fluxo/metrics';

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/fluxo/painel');
        if (res.ok) setDados((await res.json()) as FluxoPainel);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

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

      {vazio ? (
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
              Retrabalho = quantas vezes a etapa precisou ser refeita.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Etapa</th>
                    <th className="py-2 px-3 font-medium text-right">Aprovadas</th>
                    <th className="py-2 px-3 font-medium text-right">Refeitas</th>
                    <th className="py-2 px-3 font-medium text-right">Retrabalho</th>
                    <th className="py-2 pl-3 font-medium text-right">Tempo de resposta</th>
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
                      <td className="py-2 pl-3 text-right">
                        {e.horasAteDecisao != null ? `${e.horasAteDecisao} h` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
