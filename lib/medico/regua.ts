import { diasEntre, limiteDoDemonstrativo } from './conciliacao';
import type { Cirurgia, Demonstrativo, Hospital } from './types';

// Régua de cobrança (sub-projeto 116). PURA.
//
// O hospital não responde à primeira planilha de pendências; a cobrança
// precisa voltar num ritmo. A régua de cada hospital diz quantos dias esperar
// antes de cada envio: o primeiro número conta a partir do vencimento (o prazo
// do demonstrativo que deveria ter trazido a cirurgia), os seguintes contam a
// partir da cobrança anterior. Acabou a régua, repete o último intervalo.
//
// Padrão [0, 15, 30]: cobra no dia em que vence, de novo 15 dias depois, e daí
// a cada 30 dias. Sem desconto por antecipação: é hospital, não cliente.

export const REGUA_PADRAO: readonly number[] = [0, 15, 30];
export const REGUA_MAXIMA = 8;

/** A régua do hospital, limpa: inteiros entre 0 e 365, no máximo 8 etapas, nunca vazia. */
export function reguaDo(h?: Pick<Hospital, 'regua'> | null): number[] {
  const bruta = Array.isArray(h?.regua) ? h.regua : [];
  const limpa = bruta.map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n >= 0 && n <= 365).slice(0, REGUA_MAXIMA);
  return limpa.length > 0 ? limpa : [...REGUA_PADRAO];
}

/** "0, 15, 30" ↔ [0, 15, 30], para o campo de cadastro. */
export function lerRegua(texto: string): number[] {
  const nums = (texto.match(/\d+/g) ?? []).map(Number);
  return reguaDo({ regua: nums });
}

export function reguaTexto(regua: number[]): string {
  return regua.join(', ');
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Quando a cirurgia venceu: o prazo do demonstrativo do mês dela ou, se o
 * hospital mandou um demonstrativo que já cobria o mês e a deixou de fora, a
 * data em que esse demonstrativo chegou (o que vier primeiro).
 */
export function vencimentoDa(c: Cirurgia, demonstrativos: Demonstrativo[], hospital?: Hospital | null): string {
  const limite = limiteDoDemonstrativo(c.data, hospital);
  const inicioDoMes = `${c.data.slice(0, 7)}-01`;
  const semEla = demonstrativos
    .filter((d) => d.tipo !== 'direto' && d.hospital_id === c.hospital_id && d.recebido_em > c.data && d.itens.some((i) => !!i.data && i.data >= inicioDoMes))
    .map((d) => d.recebido_em)
    .sort()[0];
  return semEla && semEla < limite ? semEla : limite;
}

export type EtapaDaRegua = {
  /** Índice na régua da PRÓXIMA cobrança (0 = ainda não cobrada). */
  etapa: number;
  /** Data em que a próxima cobrança deve sair. */
  proxima: string;
  /** Rótulo curto da etapa em que a pendência está: "Vence", "+15 d"... */
  rotulo: string;
};

export function rotuloDaEtapa(regua: number[], etapa: number): string {
  if (etapa === 0) return regua[0] === 0 ? 'Vence' : `+${regua[0]} d`;
  const i = Math.min(etapa, regua.length - 1);
  return `+${regua[i]} d`;
}

/** Em que ponto da régua uma pendência está e quando é a próxima cobrança. */
export function proximaCobranca(vencimento: string, cobrancas: string[], regua: number[]): EtapaDaRegua {
  const feitas = [...cobrancas].sort();
  const etapa = feitas.length;
  const ultima = feitas.at(-1);
  const espera = regua[Math.min(etapa, regua.length - 1)] ?? 30;
  const proxima = ultima ? somarDias(ultima, Math.max(1, espera)) : somarDias(vencimento, regua[0] ?? 0);
  return { etapa, proxima, rotulo: rotuloDaEtapa(regua, etapa) };
}

export type PontoDaRegua = { etapa: number; rotulo: string; quantas: number; valor: number };

/** Quantas pendências estão em cada etapa da régua, para desenhar a linha do tempo. */
export function pontosDaRegua(regua: number[], itens: { etapa: number; valor: number | null }[]): PontoDaRegua[] {
  const pontos: PontoDaRegua[] = regua.map((_, i) => ({ etapa: i, rotulo: rotuloDaEtapa(regua, i), quantas: 0, valor: 0 }));
  // Além da última etapa, tudo cai no último ponto (a régua repete).
  for (const it of itens) {
    const p = pontos[Math.min(it.etapa, pontos.length - 1)]!;
    p.quantas += 1;
    p.valor += it.valor ?? 0;
  }
  return pontos;
}

/** Quantos dias faltam (negativo = atrasada) para a próxima cobrança. */
export function diasParaCobrar(proxima: string, hoje: string): number {
  return diasEntre(hoje, proxima);
}
