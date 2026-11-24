'use client';

import { useMemo, useState } from 'react';
import { Download, Mail } from 'lucide-react';

import { pendencias } from '@/lib/medico/conciliacao';
import { cobranca } from '@/lib/medico/mensagens';
import type { Hospital } from '@/lib/medico/types';
import { Botao, brl, CARTAO, dataBr, JanelaDeMensagem, Selo, TD, TH, type PropsDaAba } from './ui';

// Pendências a cobrar: cirurgias feitas que não apareceram em nenhum
// demonstrativo. O hospital só aceita a cobrança na planilha dele e não
// responde: aqui fica o histórico de cada envio, e o que continua em aberto
// volta para a fila até entrar num demonstrativo.

export function Pendencias({ estado, hoje, enviar, recarregar }: PropsDaAba) {
  const lista = useMemo(() => pendencias(estado.cirurgias, estado.hospitais, hoje), [estado, hoje]);
  const [cobrando, setCobrando] = useState<Hospital | null>(null);
  const { config } = estado;
  const faltaCabecalho = !config.medico_nome || !config.empresa_nome || !config.empresa_cnpj || !config.crm;

  if (lista.length === 0) {
    return <p className={`${CARTAO} text-sm text-emerald-700 dark:text-emerald-300`}>Nenhuma pendência: todas as cirurgias registradas já apareceram em um demonstrativo.</p>;
  }

  const grupos = estado.hospitais.map((h) => ({ h, itens: lista.filter((p) => p.cirurgia.hospital_id === h.id) })).filter((g) => g.itens.length > 0);
  const doHospital = (id: string) => lista.filter((p) => p.cirurgia.hospital_id === id).map((p) => p.cirurgia);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cirurgias feitas que ainda não entraram em nenhum demonstrativo. A cobrança sai na planilha de pendências, o modelo que o hospital exige. Como o hospital não costuma responder, o sistema guarda cada envio e confere sozinho a cada demonstrativo novo: o que foi pago sai daqui, o que continua volta para você cobrar de novo.
      </p>
      {faltaCabecalho && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Preencha em Cadastros o seu nome completo, a empresa, o CNPJ e o CRM: eles saem no cabeçalho da planilha de pendências.
        </p>
      )}
      {grupos.map(({ h, itens }) => {
        const atrasadas = itens.filter((p) => p.atrasada).length;
        const aCobrar = itens.filter((p) => p.cobrarAgora).length;
        const jaCobradas = itens.filter((p) => p.vezes > 0).length;
        const valor = itens.reduce((s, p) => s + (p.cirurgia.valor ?? 0), 0);
        return (
          <section key={h.id} className={CARTAO}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{h.nome}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {itens.length} {itens.length === 1 ? 'cirurgia' : 'cirurgias'} sem pagamento{valor > 0 && `, ${brl(valor)}`} · prazo de {h.prazo_pagamento_dias} dias
                  {atrasadas > 0 && ` · ${atrasadas} fora do prazo`}
                  {jaCobradas > 0 && ` · ${jaCobradas} já ${jaCobradas === 1 ? 'cobrada' : 'cobradas'} sem resposta`}
                </p>
                {aCobrar > 0 && <p className="mt-1 text-sm font-medium text-red-700 dark:text-red-300">{aCobrar === 1 ? '1 precisa' : `${aCobrar} precisam`} ser cobrada{aCobrar === 1 ? '' : 's'} agora.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`/api/medico/pendencias/${h.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
                  <Download className="h-4 w-4" aria-hidden /> Baixar planilha
                </a>
                <Botao onClick={() => setCobrando(h)}>
                  <Mail className="h-4 w-4" aria-hidden /> Enviar ao hospital
                </Botao>
              </div>
            </div>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className={TH}>Data</th>
                    <th className={TH}>Paciente</th>
                    <th className={TH}>Função</th>
                    <th className={TH}>Procedimento</th>
                    <th className={TH}>Convênio</th>
                    <th className={`${TH} text-right`}>Valor</th>
                    <th className={TH}>Situação</th>
                    <th className={TH}>Cobranças</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itens.map(({ cirurgia: c, dias, atrasada, vezes, diasSemResposta }) => (
                    <tr key={c.id}>
                      <td className={`${TD} whitespace-nowrap`}>{dataBr(c.data)}</td>
                      <td className={`${TD} whitespace-nowrap font-medium`}>{c.paciente}</td>
                      <td className={`${TD} whitespace-nowrap`}>{c.funcao}</td>
                      <td className={`${TD} min-w-[12rem]`}>{c.procedimento}</td>
                      <td className={`${TD} whitespace-nowrap`}>{c.convenio}</td>
                      <td className={`${TD} whitespace-nowrap text-right`}>{brl(c.valor)}</td>
                      <td className={TD}>
                        <Selo cor={atrasada ? 'vermelho' : 'amarelo'}>{atrasada ? `Atrasada, ${dias} dias` : `Há ${dias} ${dias === 1 ? 'dia' : 'dias'}`}</Selo>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-xs`}>
                        {vezes === 0 ? (
                          <span className="text-muted-foreground">Nunca cobrada</span>
                        ) : (
                          <>
                            {vezes} {vezes === 1 ? 'vez' : 'vezes'}, a última em {dataBr(c.cobrada_em)}
                            <span className="block text-muted-foreground">sem resposta há {diasSemResposta} {diasSemResposta === 1 ? 'dia' : 'dias'}</span>
                          </>
                        )}
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
          titulo={`Planilha de pendências: ${cobrando.nome}`}
          mensagem={cobranca(doHospital(cobrando.id), cobrando, estado.config)}
          aviso="No envio automático a planilha de pendências vai anexada. Se for enviar você mesmo, baixe a planilha e anexe."
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
            rotulo: 'Já enviei a planilha',
            executar: async () => {
              await enviar('POST', `/pendencias/${cobrando.id}`, undefined, 'Cobrança registrada.');
              setCobrando(null);
            },
          }}
        />
      )}
    </div>
  );
}
