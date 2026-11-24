import type { Cirurgia, Demonstrativo, Hospital, MedicoConfig } from './types';

// Textos prontos da Área Médica (sub-projeto 100). PURO. Sem travessão.

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

export type Mensagem = { para: string; assunto: string; corpo: string };

function assinatura(config: MedicoConfig): string {
  return config.medico_nome ? `\n\nObrigado,\n${config.medico_nome}` : '\n\nObrigado.';
}

/** E-mail ao contador pedindo a nota fiscal de um demonstrativo. */
export function pedidoDeNota(d: Demonstrativo, hospital: Hospital, config: MedicoConfig): Mensagem {
  const ref = d.referencia ? ` (${d.referencia})` : '';
  const linhas = d.itens
    .map((i) => `- ${i.data ? dataBr(i.data) : 'sem data'}: ${i.procedimento || 'cirurgia'}${i.valor != null ? `, ${brl(i.valor)}` : ''}`)
    .join('\n');
  return {
    para: config.contador_email,
    assunto: `Emissão de nota fiscal: ${hospital.nome}${ref}`,
    corpo:
      `Olá${config.contador_nome ? `, ${config.contador_nome}` : ''}.\n\n` +
      `Por favor, emita a nota fiscal para o ${hospital.nome}${ref}.\n\n` +
      `Valor total: ${brl(d.valor_total)}\n` +
      `Quantidade de procedimentos: ${d.itens.length}\n\n` +
      `Procedimentos do demonstrativo:\n${linhas}` +
      assinatura(config),
  };
}

/** E-mail ao hospital com a nota emitida. */
export function envioDaNota(d: Demonstrativo, hospital: Hospital, config: MedicoConfig): Mensagem {
  const ref = d.referencia ? ` referente a ${d.referencia}` : '';
  return {
    para: hospital.email,
    assunto: `Nota fiscal ${d.nota_numero}`.trim() + `: ${config.medico_nome || 'honorários médicos'}`,
    corpo:
      `Olá.\n\nSegue em anexo a nota fiscal ${d.nota_numero}`.trimEnd() +
      `${ref}, no valor de ${brl(d.valor_total)}.\n\nPeço a confirmação do recebimento e a data prevista do pagamento.` +
      assinatura(config),
  };
}

/**
 * Cobrança ao hospital das cirurgias que não entraram em nenhum demonstrativo.
 * A lista vai na planilha de pendências anexa (o modelo que o hospital exige);
 * o texto resume e diz quantas já tinham sido cobradas antes.
 */
export function cobranca(cirurgias: Cirurgia[], hospital: Hospital, config: MedicoConfig): Mensagem {
  const n = cirurgias.length;
  const reenviadas = cirurgias.filter((c) => (c.cobrancas ?? []).length > 0);
  const primeira = reenviadas.flatMap((c) => c.cobrancas).sort()[0];
  const total = cirurgias.reduce((s, c) => s + (c.valor ?? 0), 0);
  return {
    para: hospital.email,
    assunto: `Levantamento de pendências: ${n} ${n === 1 ? 'cirurgia' : 'cirurgias'} sem pagamento${config.medico_nome ? ` (${config.medico_nome})` : ''}`,
    corpo:
      `Olá.\n\nSegue em anexo a planilha de levantamento de pendências do ${hospital.nome}, com ` +
      `${n === 1 ? '1 cirurgia que não apareceu' : `${n} cirurgias que não apareceram`} em nenhum demonstrativo de repasse` +
      `${total > 0 ? ` (${brl(total)} no total)` : ''}.\n\n` +
      (reenviadas.length > 0
        ? `${reenviadas.length === n ? 'Todas' : reenviadas.length} ${reenviadas.length === 1 && reenviadas.length !== n ? 'delas já foi enviada' : 'já foram enviadas'} antes` +
          `${primeira ? `, a primeira vez em ${dataBr(primeira)}` : ''}, e não houve retorno.\n\n`
        : '') +
      `Peço o retorno de cada linha: se será paga e em qual repasse, ou o motivo de não ter sido faturada.` +
      assinatura(config),
  };
}

/** E-mail ao contador pedindo a nota de uma cobrança direta: o tomador é quem paga (o paciente). */
export function pedidoDeNotaDireto(d: Demonstrativo, hospital: Hospital, config: MedicoConfig): Mensagem {
  const item = d.itens[0];
  return {
    para: config.contador_email,
    assunto: `Emissão de nota fiscal: ${d.pagador_nome || 'paciente particular'}`,
    corpo:
      `Olá${config.contador_nome ? `, ${config.contador_nome}` : ''}.\n\n` +
      `Por favor, emita a nota fiscal abaixo. É cobrança direta, preciso dela o quanto antes.\n\n` +
      `Tomador: ${d.pagador_nome || 'não informado'}\n` +
      `CPF ou CNPJ: ${d.pagador_documento || 'não informado'}\n` +
      `Serviço: ${item?.procedimento || 'honorários médicos'}\n` +
      `Data: ${dataBr(d.recebido_em)}\n` +
      `Local: ${hospital.nome}\n` +
      `Valor: ${brl(d.valor_total)}` +
      assinatura(config),
  };
}

/** Mensagem ao paciente com o valor e o Pix (a nota vai em anexo). */
export function cobrancaAoPaciente(d: Demonstrativo, config: MedicoConfig): Mensagem {
  const item = d.itens[0];
  return {
    para: d.pagador_contato,
    assunto: `Honorários médicos${config.medico_nome ? `: ${config.medico_nome}` : ''}`,
    corpo:
      `Olá${d.pagador_nome ? `, ${d.pagador_nome}` : ''}.\n\n` +
      `Seguem os honorários ${item?.procedimento ? `referentes a ${item.procedimento}` : 'do procedimento'} em ${dataBr(d.recebido_em)}.\n\n` +
      `Valor: ${brl(d.valor_total)}\n` +
      (config.chave_pix ? `Pix: ${config.chave_pix}\n` : '') +
      (d.nota_numero ? `Nota fiscal: ${d.nota_numero}\n` : '') +
      `\nQualquer dúvida, é só responder esta mensagem.` +
      assinatura(config),
  };
}

/** Link mailto com o texto pronto (corpo cortado no limite que os clientes de e-mail aceitam). */
export function mailto(m: Mensagem): string {
  const corpo = m.corpo.length > 1800 ? `${m.corpo.slice(0, 1800)}\n[...]` : m.corpo;
  return `mailto:${encodeURIComponent(m.para)}?subject=${encodeURIComponent(m.assunto)}&body=${encodeURIComponent(corpo)}`;
}
