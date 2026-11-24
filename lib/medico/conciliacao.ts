import type { Cirurgia, Demonstrativo, Hospital, ItemDemonstrativo } from './types';

// Regras da Área Médica (sub-projeto 100). PURO: roda no servidor (ao gravar)
// e no navegador (prévia e painel), para a conta ser a mesma nos dois lados.
//
// O centro é o cruzamento que o médico fazia à mão: demonstrativo do hospital
// x cirurgias feitas. O que foi feito e não apareceu em nenhum demonstrativo
// é pendência para cobrar.

export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

const PARTICULAS = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']);

/** Nome sem acento, em maiúsculas, sem partículas ("Maria da Silva" → ["MARIA","SILVA"]). */
export function partesDoNome(nome: string): string[] {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s.]/g, ' ')
    .split(/[\s.]+/)
    .filter(Boolean)
    // Em iniciais ("E. S. M.") toda letra conta: "E" só é partícula no meio de um nome por extenso.
    .filter((p, i, todas) => i === 0 || todas.every((x) => x.length === 1) || !PARTICULAS.has(p));
}

/**
 * Quanto dois nomes de paciente parecem a mesma pessoa:
 * 3 = iguais; 2 = primeiro e último nome batem, ou um é as iniciais do outro;
 * 1 = só o primeiro nome bate; 0 = pessoas diferentes.
 */
export function pontosDoPaciente(a: string, b: string): number {
  const pa = partesDoNome(a);
  const pb = partesDoNome(b);
  if (pa.length === 0 || pb.length === 0) return 0;
  if (pa.join(' ') === pb.join(' ')) return 3;

  const iniciais = (p: string[]) => p.map((x) => x[0]).join('');
  const soIniciais = (p: string[]) => p.every((x) => x.length === 1) || (p.length === 1 && p[0]!.length <= 4);
  if (soIniciais(pa) || soIniciais(pb)) {
    const ia = soIniciais(pa) ? pa.join('') : iniciais(pa);
    const ib = soIniciais(pb) ? pb.join('') : iniciais(pb);
    if (ia.length >= 2 && ia === ib) return 2;
    // Iniciais só de primeiro e último nome ("MS" para Maria Aparecida Silva).
    const pontas = (p: string[]) => (p.length >= 2 ? p[0]![0]! + p[p.length - 1]![0]! : '');
    const xa = soIniciais(pa) ? ia : pontas(pa);
    const xb = soIniciais(pb) ? ib : pontas(pb);
    return xa.length === 2 && xa === xb ? 2 : 0;
  }

  const primeiro = pa[0] === pb[0];
  const ultimo = pa[pa.length - 1] === pb[pb.length - 1];
  if (primeiro && ultimo && pa.length >= 2 && pb.length >= 2) return 2;
  // Um nome contido no outro ("Maria Silva" x "Maria Aparecida Silva Costa").
  const [curto, longo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  if (curto.length >= 2 && curto.every((p) => longo.includes(p))) return 2;
  return primeiro ? 1 : 0;
}

/** Tolerância de data entre a lista do médico e o demonstrativo (cirurgia que vira a noite, digitação). */
export const TOLERANCIA_DIAS = 2;

function pontos(item: Pick<ItemDemonstrativo, 'data' | 'paciente'>, c: Cirurgia): number {
  const p = pontosDoPaciente(item.paciente, c.paciente);
  if (p < 2) return 0;
  if (!item.data) return p === 3 ? 3 : 0; // sem data, só nome idêntico
  const d = Math.abs(diasEntre(item.data, c.data));
  if (d > TOLERANCIA_DIAS) return 0;
  return p * 2 + (d === 0 ? 2 : 1);
}

/**
 * Liga cada linha do demonstrativo à cirurgia que ela paga. Só considera
 * cirurgias do mesmo hospital que ainda não estão em outro demonstrativo, e
 * cada cirurgia é usada uma vez (a de maior pontuação fica com a linha).
 */
export function casarItens<T extends Pick<ItemDemonstrativo, 'data' | 'paciente'>>(
  itens: T[],
  cirurgias: Cirurgia[],
  hospitalId: string,
): (T & { cirurgia_id: string | null })[] {
  const livres = cirurgias.filter((c) => c.hospital_id === hospitalId && !c.demonstrativo_id);
  const pares: { i: number; c: Cirurgia; p: number }[] = [];
  itens.forEach((item, i) => {
    for (const c of livres) {
      const p = pontos(item, c);
      if (p > 0) pares.push({ i, c, p });
    }
  });
  pares.sort((a, b) => b.p - a.p);

  const destino = new Map<number, string>();
  const usadas = new Set<string>();
  for (const { i, c } of pares) {
    if (destino.has(i) || usadas.has(c.id)) continue;
    destino.set(i, c.id);
    usadas.add(c.id);
  }
  return itens.map((item, i) => ({ ...item, cirurgia_id: destino.get(i) ?? null }));
}

// ---------------------------------------------------------------------------
// Etapas do demonstrativo: recebido → nota pedida → nota emitida → nota
// enviada ao hospital → pago. Derivada das datas, nunca gravada.

export const ETAPAS = ['recebido', 'nota_pedida', 'nota_emitida', 'nota_enviada', 'pago'] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_LABEL: Record<Etapa, string> = {
  recebido: 'Demonstrativo recebido',
  nota_pedida: 'Nota pedida ao contador',
  nota_emitida: 'Nota emitida',
  nota_enviada: 'Nota enviada ao hospital',
  pago: 'Pago',
};

/** O que o médico precisa fazer para sair de cada etapa. */
export const PROXIMO_PASSO: Record<Etapa, string> = {
  recebido: 'Pedir a nota ao contador',
  nota_pedida: 'Registrar a nota que o contador emitiu',
  nota_emitida: 'Enviar a nota ao hospital',
  nota_enviada: 'Confirmar o pagamento',
  pago: '',
};

/** Na cobrança direta quem recebe a nota e paga é o paciente. */
export const ETAPA_LABEL_DIRETO: Record<Etapa, string> = {
  ...ETAPA_LABEL,
  recebido: 'Cobrança registrada',
  nota_enviada: 'Nota e Pix enviados ao paciente',
};
export const PROXIMO_PASSO_DIRETO: Record<Etapa, string> = { ...PROXIMO_PASSO, nota_emitida: 'Enviar a nota e o Pix ao paciente' };

/** Dias que o paciente tem para pagar a cobrança direta antes de virar aviso. */
export const PRAZO_DIRETO_DIAS = 3;

export function etapaDe(d: Demonstrativo): Etapa {
  if (d.pago_em) return 'pago';
  if (d.nota_enviada_em) return 'nota_enviada';
  if (d.nota_emitida_em) return 'nota_emitida';
  if (d.nota_pedida_em) return 'nota_pedida';
  return 'recebido';
}

/** Dias que cada etapa pode ficar parada antes de virar aviso. */
export const PRAZO_ETAPA = { recebido: 2, nota_pedida: 3, nota_emitida: 1 } as const;

export type Aviso = {
  tipo: 'demonstrativo' | 'pendencia';
  gravidade: 'alta' | 'media';
  hospital_id: string;
  demonstrativo_id?: string;
  texto: string;
  dias: number;
};

function nomeDo(hospitais: Hospital[], id: string): string {
  return hospitais.find((h) => h.id === id)?.nome ?? 'Hospital';
}

/** Dias sem resposta depois dos quais vale reenviar a cobrança. */
export const DIAS_PARA_RECOBRAR = 30;

export type Pendencia = {
  cirurgia: Cirurgia;
  dias: number;
  atrasada: boolean;
  /** Quantas vezes já foi cobrada e há quantos dias foi a última (null = nunca cobrada). */
  vezes: number;
  diasSemResposta: number | null;
  /** Passou do prazo e nunca foi cobrada, ou a última cobrança ficou sem resposta. */
  cobrarAgora: boolean;
};

/** Cirurgias feitas que não apareceram em nenhum demonstrativo. */
export function pendencias(cirurgias: Cirurgia[], hospitais: Hospital[], hoje: string): Pendencia[] {
  return cirurgias
    .filter((c) => !c.demonstrativo_id && c.data <= hoje)
    .map((c) => {
      const prazo = hospitais.find((h) => h.id === c.hospital_id)?.prazo_pagamento_dias ?? 30;
      const dias = diasEntre(c.data, hoje);
      const cobrancas = c.cobrancas ?? [];
      const ultima = cobrancas.length > 0 ? [...cobrancas].sort().at(-1)! : null;
      const diasSemResposta = ultima ? diasEntre(ultima, hoje) : null;
      const atrasada = dias > prazo;
      return {
        cirurgia: c,
        dias,
        atrasada,
        vezes: cobrancas.length,
        diasSemResposta,
        cobrarAgora: atrasada && (diasSemResposta === null || diasSemResposta >= DIAS_PARA_RECOBRAR),
      };
    })
    .sort((a, b) => b.dias - a.dias);
}

/** A fila do "o que fazer agora", do mais urgente para o menos. */
export function avisos(
  demonstrativos: Demonstrativo[],
  cirurgias: Cirurgia[],
  hospitais: Hospital[],
  hoje: string,
): Aviso[] {
  const out: Aviso[] = [];
  for (const d of demonstrativos) {
    const etapa = etapaDe(d);
    const direto = d.tipo === 'direto';
    const nome = direto ? `${d.pagador_nome || 'Paciente'} (cobrança direta)` : nomeDo(hospitais, d.hospital_id);
    const base = { tipo: 'demonstrativo' as const, hospital_id: d.hospital_id, demonstrativo_id: d.id };
    if (etapa === 'recebido') {
      const dias = diasEntre(d.recebido_em, hoje);
      out.push({ ...base, dias, gravidade: dias > PRAZO_ETAPA.recebido ? 'alta' : 'media', texto: `${nome}: pedir a nota` });
    } else if (etapa === 'nota_pedida') {
      const dias = diasEntre(d.nota_pedida_em!, hoje);
      if (dias > PRAZO_ETAPA.nota_pedida) out.push({ ...base, dias, gravidade: 'media', texto: `${nome}: contador não emitiu a nota` });
    } else if (etapa === 'nota_emitida') {
      const dias = diasEntre(d.nota_emitida_em!, hoje);
      out.push({ ...base, dias, gravidade: dias > PRAZO_ETAPA.nota_emitida ? 'alta' : 'media', texto: `${nome}: enviar a nota ${d.nota_numero || ''}`.replace(/\s+/g, ' ').trim() });
    } else if (etapa === 'nota_enviada') {
      const prazo = direto ? PRAZO_DIRETO_DIAS : (hospitais.find((h) => h.id === d.hospital_id)?.prazo_pagamento_dias ?? 30);
      const dias = diasEntre(d.nota_enviada_em!, hoje);
      if (dias > prazo) out.push({ ...base, dias, gravidade: 'alta', texto: `${nome}: pagamento atrasado` });
    }
  }

  const porHospital = new Map<string, Pendencia[]>();
  for (const p of pendencias(cirurgias, hospitais, hoje)) {
    if (!p.atrasada) continue;
    porHospital.set(p.cirurgia.hospital_id, [...(porHospital.get(p.cirurgia.hospital_id) ?? []), p]);
  }
  for (const [hospital_id, lista] of porHospital) {
    const n = lista.length;
    const aCobrar = lista.filter((p) => p.cobrarAgora).length;
    const semResposta = lista.filter((p) => p.vezes > 0).length;
    out.push({
      tipo: 'pendencia',
      gravidade: aCobrar === 0 ? 'media' : 'alta',
      hospital_id,
      dias: lista[0]!.dias,
      texto: `${nomeDo(hospitais, hospital_id)}: ${n} ${n === 1 ? 'cirurgia' : 'cirurgias'} sem pagamento, ${aCobrar === 0 ? 'aguardando o hospital' : semResposta > 0 ? 'cobrar de novo' : 'cobrar'}`,
    });
  }

  const peso = { alta: 0, media: 1 } as const;
  return out.sort((a, b) => peso[a.gravidade] - peso[b.gravidade] || b.dias - a.dias);
}

export type Resumo = {
  /** Demonstrativos recebidos e ainda não pagos. */
  aReceber: number;
  /** Pago no mês de `hoje`. */
  recebidoNoMes: number;
  /** Cirurgias sem demonstrativo: quantidade e valor (só das que têm valor informado). */
  pendentes: number;
  valorPendente: number;
  /** Hospital pagou menos do que o demonstrativo dizia. */
  pagoAMenos: number;
};

export function resumo(demonstrativos: Demonstrativo[], cirurgias: Cirurgia[], hoje: string): Resumo {
  const mes = hoje.slice(0, 7);
  let aReceber = 0;
  let recebidoNoMes = 0;
  let pagoAMenos = 0;
  for (const d of demonstrativos) {
    if (!d.pago_em) {
      aReceber += d.valor_total;
      continue;
    }
    const pago = d.valor_pago ?? d.valor_total;
    if (d.pago_em.slice(0, 7) === mes) recebidoNoMes += pago;
    if (pago < d.valor_total - 0.005) pagoAMenos += d.valor_total - pago;
  }
  const abertas = cirurgias.filter((c) => !c.demonstrativo_id && c.data <= hoje);
  return {
    aReceber,
    recebidoNoMes,
    pendentes: abertas.length,
    valorPendente: abertas.reduce((s, c) => s + (c.valor ?? 0), 0),
    pagoAMenos,
  };
}

/** Soma das linhas, para quando o demonstrativo não traz o total. */
export function totalDosItens(itens: Pick<ItemDemonstrativo, 'valor'>[]): number {
  return Math.round(itens.reduce((s, i) => s + (i.valor ?? 0), 0) * 100) / 100;
}
