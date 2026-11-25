'use client';

import { useMemo, useState } from 'react';
import { Download, Mail } from 'lucide-react';

import { pendencias } from '@/lib/medico/conciliacao';
import { cobranca } from '@/lib/medico/mensagens';
import { pontosDaRegua, reguaDo } from '@/lib/medico/regua';
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
          Cirurgias que já deveriam ter sido pagas: o hospital mandou o demonstrativo do mês sem elas, ou o prazo de ele chegar passou. A cobrança sai na planilha de pendências, o modelo que o hospital exige. Como o hospital não costuma responder, cada envio fica registrado e a régua de cobrança de cada hospital (em Cadastros) diz quando a planilha sai de novo: no vencimento, 15 dias depois, e daí a cada 30 dias.
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
        const regua = reguaDo(h);
        const pontos = pontosDaRegua(regua, itens.map((p) => ({ etapa: p.etapa, valor: p.cirurgia.valor })));
        const proximaData = [...itens].sort((a, b) => a.proxima.localeCompare(b.proxima))[0]?.proxima;
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
              {aCobrar > 0 ? <Selo cor="vermelho">{aCobrar} para cobrar</Selo> : proximaData && <Selo cor="amarelo">próxima cobrança {dataBr(proximaData)}</Selo>}
            </div>
            <Regua pontos={pontos} ativa={aCobrar > 0} />
            <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
              {itens.map(({ cirurgia: c, dias, atrasada, vezes, diasSemResposta, cobrarAgora, proxima, rotulo }) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${atrasada ? 'bg-red-500' : 'bg-amber-400'}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.paciente}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {dataBr(c.data)} · {c.procedimento || 'Cirurgia'}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {vezes === 0 ? `Feita há ${dias} dias, nunca cobrada` : `Cobrada ${vezes} ${vezes === 1 ? 'vez' : 'vezes'}, sem resposta há ${diasSemResposta} ${diasSemResposta === 1 ? 'dia' : 'dias'}`}
                      {' · '}
                      <span className={cobrarAgora ? 'font-medium text-red-600' : ''}>{cobrarAgora ? `cobrar agora (${rotulo})` : `próxima ${dataBr(proxima)}`}</span>
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

/** A régua de cobrança como linha do tempo: uma bolinha por etapa, com quantas pendências estão nela. */
function Regua({ pontos, ativa }: { pontos: ReturnType<typeof pontosDaRegua>; ativa: boolean }) {
  return (
    <ol className="mt-4 flex items-start" aria-label="Régua de cobrança">
      {pontos.map((p, i) => {
        const ultimo = i === pontos.length - 1;
        return (
          <li key={p.etapa} className={`relative flex flex-col items-center ${ultimo ? 'shrink-0' : 'flex-1'}`}>
            {!ultimo && <span className="absolute left-1/2 top-3 h-0.5 w-full bg-neutral-200" aria-hidden />}
            <span
              className={`relative grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-bold ${p.quantas > 0 ? (ativa ? 'bg-red-500 text-white' : 'bg-medico text-white') : 'bg-neutral-200 text-neutral-500'}`}
              title={p.valor > 0 ? brl(p.valor) : undefined}
            >
              {p.quantas}
            </span>
            <span className="mt-1 text-[11px] text-neutral-500">{p.rotulo}</span>
          </li>
        );
      })}
    </ol>
  );
}
