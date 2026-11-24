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

/** Cobrança ao hospital das cirurgias feitas que não entraram em nenhum demonstrativo. */
export function cobranca(cirurgias: Cirurgia[], hospital: Hospital, config: MedicoConfig): Mensagem {
  const ordenadas = [...cirurgias].sort((a, b) => a.data.localeCompare(b.data));
  const linhas = ordenadas
    .map(
      (c) =>
        `- ${dataBr(c.data)}: paciente ${c.paciente}${c.procedimento ? `, ${c.procedimento}` : ''}` +
        `${c.convenio ? ` (${c.convenio})` : ''}${c.valor != null ? `, ${brl(c.valor)}` : ''}`,
    )
    .join('\n');
  const n = ordenadas.length;
  return {
    para: hospital.email,
    assunto: `Cirurgias sem pagamento: ${n} ${n === 1 ? 'pendência' : 'pendências'}`,
    corpo:
      `Olá.\n\nConferi os demonstrativos recebidos do ${hospital.nome} e ` +
      `${n === 1 ? 'a cirurgia abaixo não apareceu' : `as ${n} cirurgias abaixo não apareceram`} em nenhum deles:\n\n` +
      `${linhas}\n\nPeço a verificação e a inclusão no próximo demonstrativo, ou o retorno com o motivo.` +
      assinatura(config),
  };
}

/** Link mailto com o texto pronto (corpo cortado no limite que os clientes de e-mail aceitam). */
export function mailto(m: Mensagem): string {
  const corpo = m.corpo.length > 1800 ? `${m.corpo.slice(0, 1800)}\n[...]` : m.corpo;
  return `mailto:${encodeURIComponent(m.para)}?subject=${encodeURIComponent(m.assunto)}&body=${encodeURIComponent(corpo)}`;
}
