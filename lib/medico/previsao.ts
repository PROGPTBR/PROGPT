import { diasEntre, etapaDe, pendencias, PRAZO_DIRETO_DIAS, resumo, type Etapa } from './conciliacao';
import type { Cirurgia, Demonstrativo, EstadoMedico, Hospital } from './types';

// Previsão do mês e relatório da semana (sub-projeto 116). PURO.
//
// "O funil que já mostra a previsão do mês": cada nota em aberto tem uma
// chance de cair no mês conforme a etapa em que está. O que já foi pago entra
// inteiro; o que o hospital deixou de fora entra com chance baixa.

/** Chance de uma nota ser paga no prazo, pela etapa em que está. */
export const CHANCE_POR_ETAPA: Record<Exclude<Etapa, 'pago'>, number> = {
  nota_enviada: 0.9,
  nota_emitida: 0.75,
  nota_pedida: 0.6,
  recebido: 0.5,
};
/** Cirurgia que ficou de fora do demonstrativo: o hospital raramente paga na primeira cobrança. */
export const CHANCE_PENDENCIA = 0.3;

export const ETAPA_CURTA: Record<Exclude<Etapa, 'pago'>, string> = {
  recebido: 'Demonstrativo recebido',
  nota_pedida: 'Nota pedida',
  nota_emitida: 'Nota emitida',
  nota_enviada: 'Nota enviada',
};

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function fimDoMes(hoje: string): string {
  const [ano, mes] = hoje.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

/** Quando o pagamento de um demonstrativo em aberto deve cair. */
export function previsaoDePagamento(d: Demonstrativo, hospitais: Hospital[], hoje: string): string {
  const prazo = d.tipo === 'direto' ? PRAZO_DIRETO_DIAS : (hospitais.find((h) => h.id === d.hospital_id)?.prazo_pagamento_dias ?? 30);
  if (d.nota_enviada_em) return somarDias(d.nota_enviada_em, prazo);
  // Ainda sem nota enviada: uns 7 dias para a nota sair, mais o prazo do hospital.
  return somarDias(hoje, 7 + prazo);
}

export type FaixaDoFunil = { etapa: Exclude<Etapa, 'pago'> | 'pendencia'; rotulo: string; notas: number; valor: number; chance: number; ponderado: number };

export type Previsao = {
  mes: string;
  /** Já caiu neste mês. */
  recebido: number;
  /** Em aberto com previsão de cair até o fim do mês, pelo valor cheio. */
  previstoNoMes: number;
  /** O mesmo, ponderado pela chance de cada etapa. */
  ponderadoNoMes: number;
  /** Recebido + ponderado: o número que vale planejar. */
  esperadoNoMes: number;
  /** Tudo o que está em aberto, mês que for. */
  totalEmAberto: number;
  totalPonderado: number;
  funil: FaixaDoFunil[];
  ranking: { hospital_id: string; nome: string; aReceber: number; recebido: number; pendentes: number; valorPendente: number }[];
};

export function previsaoDoMes(estado: Pick<EstadoMedico, 'demonstrativos' | 'cirurgias' | 'hospitais'>, hoje: string): Previsao {
  const { demonstrativos, cirurgias, hospitais } = estado;
  const mes = hoje.slice(0, 7);
  const fim = fimDoMes(hoje);
  const faixas = new Map<FaixaDoFunil['etapa'], FaixaDoFunil>();
  const faixa = (etapa: FaixaDoFunil['etapa'], rotulo: string, chance: number) => {
    if (!faixas.has(etapa)) faixas.set(etapa, { etapa, rotulo, notas: 0, valor: 0, chance, ponderado: 0 });
    return faixas.get(etapa)!;
  };
  let recebido = 0;
  let previstoNoMes = 0;
  let ponderadoNoMes = 0;
  let totalEmAberto = 0;
  let totalPonderado = 0;
  const porHospital = new Map<string, { aReceber: number; recebido: number }>();
  const conta = (id: string) => {
    if (!porHospital.has(id)) porHospital.set(id, { aReceber: 0, recebido: 0 });
    return porHospital.get(id)!;
  };

  for (const d of demonstrativos) {
    if (d.pago_em) {
      if (d.pago_em.slice(0, 7) === mes) {
        recebido += d.valor_pago ?? d.valor_total;
        conta(d.hospital_id).recebido += d.valor_pago ?? d.valor_total;
      }
      continue;
    }
    const etapa = etapaDe(d) as Exclude<Etapa, 'pago'>;
    const chance = CHANCE_POR_ETAPA[etapa];
    const f = faixa(etapa, ETAPA_CURTA[etapa], chance);
    f.notas += 1;
    f.valor += d.valor_total;
    f.ponderado += d.valor_total * chance;
    totalEmAberto += d.valor_total;
    totalPonderado += d.valor_total * chance;
    conta(d.hospital_id).aReceber += d.valor_total;
    if (previsaoDePagamento(d, hospitais, hoje) <= fim) {
      previstoNoMes += d.valor_total;
      ponderadoNoMes += d.valor_total * chance;
    }
  }

  // Cirurgias que ficaram de fora e já foram cobradas: entram com chance baixa, só no total.
  const atrasadas = pendencias(cirurgias, hospitais, hoje, demonstrativos).filter((p) => p.atrasada);
  if (atrasadas.length > 0) {
    const f = faixa('pendencia', 'Fora do demonstrativo', CHANCE_PENDENCIA);
    for (const p of atrasadas) {
      const v = p.cirurgia.valor ?? 0;
      f.notas += 1;
      f.valor += v;
      f.ponderado += v * CHANCE_PENDENCIA;
      totalEmAberto += v;
      totalPonderado += v * CHANCE_PENDENCIA;
    }
  }

  const ordem: FaixaDoFunil['etapa'][] = ['nota_enviada', 'nota_emitida', 'nota_pedida', 'recebido', 'pendencia'];
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const ranking = hospitais
    .map((h) => {
      const pend = atrasadas.filter((p) => p.cirurgia.hospital_id === h.id);
      const c = porHospital.get(h.id) ?? { aReceber: 0, recebido: 0 };
      return { hospital_id: h.id, nome: h.nome, aReceber: r2(c.aReceber), recebido: r2(c.recebido), pendentes: pend.length, valorPendente: r2(pend.reduce((s, p) => s + (p.cirurgia.valor ?? 0), 0)) };
    })
    .filter((h) => h.aReceber > 0 || h.recebido > 0 || h.pendentes > 0)
    .sort((a, b) => b.aReceber + b.recebido - (a.aReceber + a.recebido));

  return {
    mes,
    recebido: r2(recebido),
    previstoNoMes: r2(previstoNoMes),
    ponderadoNoMes: r2(ponderadoNoMes),
    esperadoNoMes: r2(recebido + ponderadoNoMes),
    totalEmAberto: r2(totalEmAberto),
    totalPonderado: r2(totalPonderado),
    funil: ordem.map((e) => faixas.get(e)).filter((f): f is FaixaDoFunil => !!f).map((f) => ({ ...f, valor: r2(f.valor), ponderado: r2(f.ponderado) })),
    ranking,
  };
}

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

/**
 * O relatório da semana para colar no WhatsApp do sócio, do contador ou da
 * secretária. Sem nome de paciente: sai da tela protegida por login.
 */
export function relatorioDaSemana(estado: Pick<EstadoMedico, 'demonstrativos' | 'cirurgias' | 'hospitais' | 'config'>, hoje: string): string {
  const { demonstrativos, cirurgias, hospitais, config } = estado;
  const inicio = somarDias(hoje, -6);
  const naSemana = (iso: string | null | undefined) => !!iso && iso >= inicio && iso <= hoje;
  const nomeDo = (id: string) => hospitais.find((h) => h.id === id)?.nome ?? 'Hospital';

  const pagas = demonstrativos.filter((d) => naSemana(d.pago_em));
  const recebidoNaSemana = pagas.reduce((s, d) => s + (d.valor_pago ?? d.valor_total), 0);
  const enviadas = demonstrativos.filter((d) => naSemana(d.nota_enviada_em));
  const pedidas = demonstrativos.filter((d) => naSemana(d.nota_pedida_em));
  const chegaram = demonstrativos.filter((d) => d.tipo !== 'direto' && naSemana(d.recebido_em));
  const operadas = cirurgias.filter((c: Cirurgia) => naSemana(c.data) && !c.confirmar);
  const cobradas = cirurgias.filter((c) => (c.cobrancas ?? []).some(naSemana));
  const r = resumo(demonstrativos, cirurgias, hoje, hospitais);
  const p = previsaoDoMes(estado, hoje);
  const atrasadas = demonstrativos.filter((d) => !d.pago_em && d.nota_enviada_em && diasEntre(d.nota_enviada_em, hoje) > (d.tipo === 'direto' ? PRAZO_DIRETO_DIAS : (hospitais.find((h) => h.id === d.hospital_id)?.prazo_pagamento_dias ?? 30)));

  const linhas: string[] = [];
  linhas.push(`*Resumo da semana${config.medico_nome ? ` · ${config.medico_nome}` : ''}*`);
  linhas.push(`${dataBr(inicio)} a ${dataBr(hoje)}`);
  linhas.push('');
  linhas.push(`💰 Recebido na semana: ${brl(recebidoNaSemana)}${pagas.length > 0 ? ` (${pagas.length} ${pagas.length === 1 ? 'nota' : 'notas'})` : ''}`);
  linhas.push(`📈 Esperado no mês: ${brl(p.esperadoNoMes)} (${brl(p.recebido)} já caiu + ${brl(p.ponderadoNoMes)} previsto)`);
  linhas.push(`📄 A receber no total: ${brl(r.aReceber)}`);
  linhas.push('');
  linhas.push('*Na semana*');
  linhas.push(`• ${operadas.length} ${operadas.length === 1 ? 'cirurgia feita' : 'cirurgias feitas'}`);
  linhas.push(`• ${chegaram.length} ${chegaram.length === 1 ? 'demonstrativo recebido' : 'demonstrativos recebidos'}`);
  linhas.push(`• ${pedidas.length} ${pedidas.length === 1 ? 'nota pedida' : 'notas pedidas'} ao contador, ${enviadas.length} ${enviadas.length === 1 ? 'enviada' : 'enviadas'} ao hospital`);
  linhas.push(`• ${cobradas.length} ${cobradas.length === 1 ? 'cirurgia cobrada' : 'cirurgias cobradas'} na planilha de pendências`);
  linhas.push('');
  linhas.push('*Atenção*');
  linhas.push(`• ${r.pendentes} ${r.pendentes === 1 ? 'cirurgia' : 'cirurgias'} fora do demonstrativo${r.valorPendente > 0 ? ` (${brl(r.valorPendente)})` : ''}`);
  linhas.push(`• ${atrasadas.length} ${atrasadas.length === 1 ? 'pagamento atrasado' : 'pagamentos atrasados'}`);
  if (r.pagoAMenos > 0) linhas.push(`• Pago a menos: ${brl(r.pagoAMenos)}`);
  if (p.ranking.length > 0) {
    linhas.push('');
    linhas.push('*Por hospital*');
    for (const h of p.ranking) {
      const partes = [`a receber ${brl(h.aReceber)}`];
      if (h.recebido > 0) partes.push(`recebido no mês ${brl(h.recebido)}`);
      if (h.pendentes > 0) partes.push(`${h.pendentes} fora do demonstrativo`);
      linhas.push(`• ${nomeDo(h.hospital_id)}: ${partes.join(', ')}`);
    }
  }
  return linhas.join('\n');
}
