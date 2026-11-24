// Dados fictícios da Área Médica (sub-projeto 100), para a apresentação.
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
  });

  const cirurgias = [
    // Niterói D'Or: mês passado (pago) e mês corrente (parte sem pagamento).
    c('dor', -78, 'M. A. S.', 'Colecistectomia videolaparoscópica', 'Bradesco Saúde', 3200),
    c('dor', -74, 'J. P. R.', 'Hernioplastia inguinal', 'SulAmérica', 2600),
    c('dor', -70, 'C. L. F.', 'Apendicectomia', 'Amil', 2400),
    c('dor', -52, 'R. T. O.', 'Colecistectomia videolaparoscópica', 'Unimed', 3200),
    c('dor', -49, 'A. B. C.', 'Hernioplastia umbilical', 'Bradesco Saúde', 2100),
    c('dor', -47, 'L. M. N.', 'Gastroplastia', 'SulAmérica', 6800),
    c('dor', -45, 'P. H. S.', 'Apendicectomia', 'Particular', 4500),
    c('dor', -41, 'F. G. A.', 'Hernioplastia inguinal', 'Amil', 2600),
    c('dor', -12, 'T. R. V.', 'Colecistectomia videolaparoscópica', 'Unimed', 3200),
    c('dor', -6, 'E. S. M.', 'Hernioplastia incisional', 'Bradesco Saúde', 3900),
    // CHN
    c('chn', -40, 'V. C. D.', 'Tireoidectomia', 'Unimed', 5200),
    c('chn', -36, 'N. O. P.', 'Colecistectomia videolaparoscópica', 'Amil', 3100),
    c('chn', -20, 'G. F. L.', 'Hernioplastia inguinal', 'SulAmérica', 2500),
    c('chn', -9, 'D. A. R.', 'Apendicectomia', 'Bradesco Saúde', 2400),
    // Hospital Itaipu
    c('itaipu', -33, 'S. M. B.', 'Hernioplastia umbilical', 'Unimed', 2000),
    c('itaipu', -30, 'I. C. T.', 'Colecistectomia videolaparoscópica', 'Amil', 3000),
    c('itaipu', -4, 'B. R. S.', 'Hernioplastia inguinal', 'Particular', 3800),
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
    config: { medico_nome: 'Dr. Ricardo Menezes', contador_nome: 'Paula', contador_email: 'paula@contabilidade-exemplo.com.br' },
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
