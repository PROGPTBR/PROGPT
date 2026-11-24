import { casarItens, totalDosItens } from './conciliacao';
import { CONFIG_VAZIA, type Cirurgia, type Demonstrativo, type EstadoMedico, type Hospital } from './types';

// Dados fictícios da Área Médica (sub-projeto 100), para a apresentação.
// O médico do exemplo leva o nome do Dr. Eduardo Kastrup (pedido do Alexandre,
// 2026-11-24: a apresentação é para ele) e os procedimentos são de ortopedia.
// Empresa, CNPJ, CRM, telefone e pacientes continuam inventados.
// Datas relativas a hoje, para os prazos e avisos fazerem sentido em qualquer
// dia. Nenhum nome é de paciente real.

function dia(hoje: string, deslocamento: number): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deslocamento);
  return d.toISOString().slice(0, 10);
}

type LinhaEx = { data: string; paciente: string; procedimento: string; convenio: string; valor: number };

export function dadosDeExemplo(hoje: string) {
  const c = (hospital: string, dias: number, paciente: string, procedimento: string, convenio: string, valor: number) => ({
    hospital,
    data: dia(hoje, dias),
    paciente,
    procedimento,
    convenio,
    valor,
    funcao: 'Cirurgião',
    // As duas que o hospital deixou de fora já foram cobradas uma vez, sem resposta.
    cobrancas: paciente === 'L. M. N.' || paciente === 'P. H. S.' ? [dia(hoje, -32)] : ([] as string[]),
  });

  const cirurgias = [
    // Niterói D'Or: mês passado (pago) e mês corrente (parte sem pagamento).
    c('dor', -78, 'M. A. S.', 'Reconstrução de ligamento do joelho', 'Bradesco Saúde', 3200),
    c('dor', -74, 'J. P. R.', 'Reparo do manguito rotador', 'SulAmérica', 2600),
    c('dor', -70, 'C. L. F.', 'Fratura de punho: redução e fixação', 'Amil', 2400),
    c('dor', -52, 'R. T. O.', 'Reconstrução de ligamento do joelho', 'Unimed', 3200),
    c('dor', -49, 'A. B. C.', 'Sutura de menisco', 'Bradesco Saúde', 2100),
    c('dor', -47, 'L. M. N.', 'Artroplastia total de joelho', 'SulAmérica', 6800),
    c('dor', -45, 'P. H. S.', 'Fratura de punho: redução e fixação', 'Particular', 4500),
    c('dor', -41, 'F. G. A.', 'Reparo do manguito rotador', 'Amil', 2600),
    c('dor', -12, 'T. R. V.', 'Reconstrução de ligamento do joelho', 'Unimed', 3200),
    c('dor', -6, 'E. S. M.', 'Fratura de fêmur: tratamento cirúrgico', 'Bradesco Saúde', 3900),
    // CHN
    c('chn', -40, 'V. C. D.', 'Artroplastia total de quadril', 'Unimed', 5200),
    c('chn', -36, 'N. O. P.', 'Reconstrução de ligamento do joelho', 'Amil', 3100),
    c('chn', -20, 'G. F. L.', 'Reparo do manguito rotador', 'SulAmérica', 2500),
    c('chn', -9, 'D. A. R.', 'Fratura de punho: redução e fixação', 'Bradesco Saúde', 2400),
    // Hospital Itaipu
    c('itaipu', -33, 'S. M. B.', 'Sutura de menisco', 'Unimed', 2000),
    c('itaipu', -30, 'I. C. T.', 'Reconstrução de ligamento do joelho', 'Amil', 3000),
    c('itaipu', -4, 'B. R. S.', 'Reparo do manguito rotador', 'Particular', 3800),
  ];

  const linhas = (hospital: string, de: number, ate: number, fora: string[] = []): LinhaEx[] =>
    cirurgias
      .filter((x) => x.hospital === hospital && x.data >= dia(hoje, de) && x.data <= dia(hoje, ate) && !fora.includes(x.paciente))
      .map(({ data, paciente, procedimento, convenio, valor }) => ({ data, paciente, procedimento, convenio, valor }));

  const d = (
    hospital: string,
    referencia: string,
    recebido: number,
    itens: LinhaEx[],
    etapas: { pedida?: number; emitida?: number; numero?: string; enviada?: number; pago?: number; valor_pago?: number },
  ) => ({
    hospital,
    referencia,
    recebido_em: dia(hoje, recebido),
    itens,
    nota_pedida_em: etapas.pedida == null ? null : dia(hoje, etapas.pedida),
    nota_numero: etapas.numero ?? '',
    nota_emitida_em: etapas.emitida == null ? null : dia(hoje, etapas.emitida),
    nota_enviada_em: etapas.enviada == null ? null : dia(hoje, etapas.enviada),
    pago_em: etapas.pago == null ? null : dia(hoje, etapas.pago),
    valor_pago: etapas.valor_pago ?? null,
  });

  // Dentro do mês corrente, para o indicador "Recebido neste mês" ter valor.
  const pagoNoMes = -Math.min(Number(hoje.slice(8, 10)) - 1, 8);

  return {
    config: {
      medico_nome: 'Dr. Eduardo Kastrup',
      contador_nome: 'Paula',
      contador_email: 'paula@contabilidade-exemplo.com.br',
      empresa_nome: 'Empresa de exemplo Serviços Ortopédicos Ltda',
      empresa_cnpj: '11.222.333/0001-81',
      crm: '52.00000-0',
      especialidade: 'Ortopedia',
      contato: '(21) 90000-0000',
    } as const,
    hospitais: [
      { chave: 'dor', nome: "Niterói D'Or", email: 'repasse@hospital-exemplo.com.br', prazo: 30 },
      { chave: 'chn', nome: 'CHN', email: 'honorarios@chn-exemplo.com.br', prazo: 30 },
      { chave: 'itaipu', nome: 'Hospital Itaipu', email: 'financeiro@itaipu-exemplo.com.br', prazo: 45 },
    ],
    cirurgias,
    demonstrativos: [
      // Ciclo completo, pago neste mês e com R$ 320 a menos que o demonstrativo.
      d('dor', 'Repasse do mês retrasado', -60, linhas('dor', -80, -65), { pedida: -59, emitida: -57, numero: '1041', enviada: -57, pago: pagoNoMes, valor_pago: 7880 }),
      // O hospital deixou duas cirurgias de fora (L. M. N. e P. H. S.): viram pendência.
      d('dor', 'Repasse do mês passado', -22, linhas('dor', -55, -40, ['L. M. N.', 'P. H. S.']), { pedida: -21, emitida: -19, numero: '1058', enviada: -19 }),
      // Nota emitida e parada: falta mandar para o hospital.
      d('chn', 'Honorários do mês passado', -10, linhas('chn', -45, -30), { pedida: -9, emitida: -6, numero: '1063' }),
      // Acabou de chegar: falta pedir a nota.
      d('itaipu', 'Repasse do mês passado', -3, linhas('itaipu', -35, -25), {}),
    ],
  };
}

/**
 * O mesmo conteúdo de "Carregar exemplo", montado em memória (sem banco).
 * Serve à prévia local do visual e aos testes de tela.
 */
export function estadoDeExemplo(hoje: string): Omit<EstadoMedico, 'integracoes'> {
  const ex = dadosDeExemplo(hoje);
  const hospitais: Hospital[] = ex.hospitais.map((h) => ({ id: h.chave, nome: h.nome, email: h.email, prazo_pagamento_dias: h.prazo, exemplo: true }));
  let cirurgias: Cirurgia[] = ex.cirurgias.map((c, i) => ({
    id: `c${i}`,
    hospital_id: c.hospital,
    data: c.data,
    paciente: c.paciente,
    procedimento: c.procedimento,
    convenio: c.convenio,
    valor: c.valor,
    origem: 'whatsapp',
    demonstrativo_id: null,
    cobrada_em: c.cobrancas.at(-1) ?? null,
    funcao: c.funcao,
    registro: '',
    hora: '',
    cobrancas: c.cobrancas,
    observacao: '',
    exemplo: true,
  }));
  const demonstrativos: Demonstrativo[] = ex.demonstrativos.map((d, i) => {
    const itens = casarItens(d.itens, cirurgias, d.hospital);
    const ids = new Set(itens.map((x) => x.cirurgia_id));
    cirurgias = cirurgias.map((c) => (ids.has(c.id) ? { ...c, demonstrativo_id: `d${i}` } : c));
    return {
      id: `d${i}`,
      hospital_id: d.hospital,
      referencia: d.referencia,
      recebido_em: d.recebido_em,
      valor_total: totalDosItens(d.itens),
      itens,
      nota_pedida_em: d.nota_pedida_em,
      nota_numero: d.nota_numero,
      nota_emitida_em: d.nota_emitida_em,
      nota_enviada_em: d.nota_enviada_em,
      pago_em: d.pago_em,
      valor_pago: d.valor_pago,
      exemplo: true,
      tipo: 'hospital',
      pagador_nome: '',
      pagador_documento: '',
      pagador_contato: '',
    };
  });
  return { config: { ...CONFIG_VAZIA, ...ex.config }, hospitais, cirurgias, demonstrativos, entradas: [], conta: null, movimentos: [], documentos: [], indicacoes: [] };
}
