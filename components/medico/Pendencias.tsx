'use client';

import { useMemo, useState } from 'react';
import { Mail } from 'lucide-react';

import { pendencias } from '@/lib/medico/conciliacao';
import { cobranca } from '@/lib/medico/mensagens';
import type { Hospital } from '@/lib/medico/types';
import { Botao, brl, CARTAO, dataBr, JanelaDeMensagem, Selo, TD, TH, type PropsDaAba } from './ui';

// Pendências a cobrar: cirurgias feitas que não apareceram em nenhum
// demonstrativo. É o cruzamento que o médico fazia à mão.

export function Pendencias({ estado, hoje, enviar, recarregar }: PropsDaAba) {
  const lista = useMemo(() => pendencias(estado.cirurgias, estado.hospitais, hoje), [estado, hoje]);
  const [cobrando, setCobrando] = useState<Hospital | null>(null);

  if (lista.length === 0) {
    return <p className={`${CARTAO} text-sm text-emerald-700 dark:text-emerald-300`}>Nenhuma pendência: todas as cirurgias registradas já apareceram em um demonstrativo.</p>;
  }

  const grupos = estado.hospitais.map((h) => ({ h, itens: lista.filter((p) => p.cirurgia.hospital_id === h.id) })).filter((g) => g.itens.length > 0);
  const doHospital = (id: string) => lista.filter((p) => p.cirurgia.hospital_id === id).map((p) => p.cirurgia);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cirurgias feitas que ainda não entraram em nenhum demonstrativo. Passou do prazo do hospital, vale cobrar: o texto sai pronto, com a lista.
      </p>
      {grupos.map(({ h, itens }) => {
        const atrasadas = itens.filter((p) => p.atrasada).length;
        const valor = itens.reduce((s, p) => s + (p.cirurgia.valor ?? 0), 0);
        return (
          <section key={h.id} className={CARTAO}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{h.nome}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {itens.length} {itens.length === 1 ? 'cirurgia' : 'cirurgias'} sem pagamento{valor > 0 && `, ${brl(valor)}`} · prazo de {h.prazo_pagamento_dias} dias
                  {atrasadas > 0 && ` · ${atrasadas} fora do prazo`}
                </p>
              </div>
              <Botao onClick={() => setCobrando(h)}>
                <Mail className="h-4 w-4" aria-hidden /> Gerar cobrança
              </Botao>
            </div>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className={TH}>Data</th>
                    <th className={TH}>Paciente</th>
                    <th className={TH}>Procedimento</th>
                    <th className={TH}>Convênio</th>
                    <th className={`${TH} text-right`}>Valor</th>
                    <th className={TH}>Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itens.map(({ cirurgia: c, dias, atrasada }) => (
                    <tr key={c.id}>
                      <td className={`${TD} whitespace-nowrap`}>{dataBr(c.data)}</td>
                      <td className={`${TD} whitespace-nowrap font-medium`}>{c.paciente}</td>
                      <td className={`${TD} min-w-[12rem]`}>{c.procedimento}</td>
                      <td className={`${TD} whitespace-nowrap`}>{c.convenio}</td>
                      <td className={`${TD} whitespace-nowrap text-right`}>{brl(c.valor)}</td>
                      <td className={TD}>
                        <Selo cor={atrasada ? 'vermelho' : 'amarelo'}>{atrasada ? `Atrasada, ${dias} dias` : `Há ${dias} ${dias === 1 ? 'dia' : 'dias'}`}</Selo>
                        {c.cobrada_em && <span className="ml-2 text-xs text-muted-foreground">cobrada em {dataBr(c.cobrada_em)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {cobrando && (
        <JanelaDeMensagem
          titulo={`Cobrança: ${cobrando.nome}`}
          mensagem={cobranca(doHospital(cobrando.id), cobrando, estado.config)}
          onFechar={() => setCobrando(null)}
          envio={{
            tipo: 'cobranca_hospital',
            id: cobrando.id,
            canais: estado.integracoes.email_envio ? ['email'] : [],
            aoEnviar: async () => {
              await recarregar();
              setCobrando(null);
            },
          }}
          acao={{
            rotulo: 'Já cobrei',
            executar: async () => {
              const ids = doHospital(cobrando.id).map((c) => c.id);
              for (const id of ids.slice(0, -1)) await fetch(`/api/medico/cirurgias/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cobrada_em: hoje }) });
              await enviar('PATCH', `/cirurgias/${ids.at(-1)}`, { cobrada_em: hoje }, 'Cobrança registrada.');
              setCobrando(null);
            },
          }}
        />
      )}
    </div>
  );
}
