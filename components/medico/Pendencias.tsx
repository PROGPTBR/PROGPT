'use client';

import { useMemo, useState } from 'react';
import { Download, Mail } from 'lucide-react';

import { pendencias } from '@/lib/medico/conciliacao';
import { cobranca } from '@/lib/medico/mensagens';
import type { Hospital } from '@/lib/medico/types';
import { Botao, brl, CARTAO, dataBr, Info, JanelaDeMensagem, Selo, type PropsDaAba } from './ui';

// Pendências a cobrar: cirurgias feitas que não apareceram em nenhum
// demonstrativo. O hospital só aceita a cobrança na planilha dele e não
// responde: aqui fica o histórico de cada envio, e o que continua em aberto
// volta para a fila até entrar num demonstrativo.

export function Pendencias({ estado, hoje, enviar, recarregar }: PropsDaAba) {
  const todas = useMemo(() => pendencias(estado.cirurgias, estado.hospitais, hoje, estado.demonstrativos), [estado, hoje]);
  // Só é pendência o que já deveria ter vindo num demonstrativo. O resto está no ciclo normal do mês.
  const lista = todas.filter((p) => p.atrasada);
  const aguardando = todas.length - lista.length;
  const [cobrando, setCobrando] = useState<Hospital | null>(null);
  const { config } = estado;
  const faltaCabecalho = !config.medico_nome || !config.empresa_nome || !config.empresa_cnpj || !config.crm;

  if (lista.length === 0) {
    return (
      <div className={`${CARTAO} text-sm`}>
        <p className="font-medium text-emerald-700">Nada para cobrar agora.</p>
        {aguardando > 0 && (
          <p className="mt-1 text-neutral-500">
            {aguardando} {aguardando === 1 ? 'cirurgia está' : 'cirurgias estão'} dentro do ciclo normal, esperando o demonstrativo do mês.
          </p>
        )}
      </div>
    );
  }

  const grupos = estado.hospitais.map((h) => ({ h, itens: lista.filter((p) => p.cirurgia.hospital_id === h.id) })).filter((g) => g.itens.length > 0);
  const doHospital = (id: string) => lista.filter((p) => p.cirurgia.hospital_id === id).map((p) => p.cirurgia);

  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-1 text-xl font-semibold">
        A cobrar{' '}
        <Info>
          Cirurgias que já deveriam ter sido pagas: o hospital mandou o demonstrativo do mês sem elas, ou o prazo de ele chegar passou. A cobrança sai na planilha de pendências, o modelo que o hospital exige. Como o hospital não costuma responder, cada envio fica registrado e o que continua sem pagamento volta para cobrar de novo.
        </Info>
      </h2>
      {aguardando > 0 && (
        <p className="text-sm text-neutral-500">
          Além destas, {aguardando} {aguardando === 1 ? 'cirurgia está' : 'cirurgias estão'} dentro do ciclo normal, esperando o demonstrativo do mês.
        </p>
      )}
      {faltaCabecalho && (
        <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">Falta preencher seu nome, empresa, CNPJ e CRM em Cadastros: eles saem na planilha.</p>
      )}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      {grupos.map(({ h, itens }) => {
        const aCobrar = itens.filter((p) => p.cobrarAgora).length;
        const valor = itens.reduce((s, p) => s + (p.cirurgia.valor ?? 0), 0);
        return (
          <section key={h.id} className="lg:rounded-[2rem] lg:bg-white lg:p-6 lg:ring-1 lg:ring-black/[0.05]">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">{h.nome}</h3>
                <p className="text-sm text-neutral-500">
                  {itens.length} {itens.length === 1 ? 'cirurgia' : 'cirurgias'}
                  {valor > 0 && ` · ${brl(valor)}`}
                </p>
              </div>
              {aCobrar > 0 && <Selo cor="vermelho">{aCobrar} para cobrar</Selo>}
            </div>
            <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
              {itens.map(({ cirurgia: c, dias, atrasada, vezes, diasSemResposta }) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${atrasada ? 'bg-red-500' : 'bg-amber-400'}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.paciente}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {dataBr(c.data)} · {c.procedimento || 'Cirurgia'}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {vezes === 0 ? `Feita há ${dias} dias, nunca cobrada` : `Cobrada ${vezes} ${vezes === 1 ? 'vez' : 'vezes'}, sem resposta há ${diasSemResposta} ${diasSemResposta === 1 ? 'dia' : 'dias'}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{c.valor == null ? '' : brl(c.valor)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Botao onClick={() => setCobrando(h)}>
                <Mail className="h-4 w-4" aria-hidden /> Enviar ao hospital
              </Botao>
              <a href={`/api/medico/pendencias/${h.id}`} className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-200">
                <Download className="h-4 w-4" aria-hidden /> Baixar planilha
              </a>
            </div>
          </section>
        );
      })}
      </div>

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
