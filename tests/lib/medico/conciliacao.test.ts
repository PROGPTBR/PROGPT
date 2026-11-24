import { describe, expect, it } from 'vitest';

import { areaMedicaLiberada, caminhoDoMedico, soAreaMedica } from '@/lib/medico/acesso';
import { avisos, casarItens, etapaDe, pendencias, pontosDoPaciente, resumo } from '@/lib/medico/conciliacao';
import { dadosDeExemplo } from '@/lib/medico/exemplo';
import { cobranca, mailto, pedidoDeNota } from '@/lib/medico/mensagens';
import { CONFIG_VAZIA, type Cirurgia, type Demonstrativo, type Hospital } from '@/lib/medico/types';

const HOJE = '2026-11-24';
const H: Hospital = { id: 'h1', nome: "Niterói D'Or", email: 'repasse@h.com', prazo_pagamento_dias: 30, exemplo: false };
const H2: Hospital = { ...H, id: 'h2', nome: 'CHN' };

function cir(id: string, data: string, paciente: string, extra: Partial<Cirurgia> = {}): Cirurgia {
  return { id, hospital_id: 'h1', data, paciente, procedimento: 'Colecistectomia', convenio: 'Unimed', valor: 3000, origem: 'manual', demonstrativo_id: null, cobrada_em: null, funcao: '', registro: '', hora: '', cobrancas: [], observacao: '', exemplo: false, ...extra };
}

function dem(extra: Partial<Demonstrativo> = {}): Demonstrativo {
  return { id: 'd1', hospital_id: 'h1', referencia: 'outubro/2026', recebido_em: '2026-11-20', valor_total: 6000, itens: [], nota_pedida_em: null, nota_numero: '', nota_emitida_em: null, nota_enviada_em: null, pago_em: null, valor_pago: null, exemplo: false, tipo: 'hospital', pagador_nome: '', pagador_documento: '', pagador_contato: '', ...extra };
}

describe('nome do paciente', () => {
  it('reconhece a mesma pessoa escrita de formas diferentes', () => {
    expect(pontosDoPaciente('Maria Aparecida da Silva', 'MARIA APARECIDA SILVA')).toBe(3);
    expect(pontosDoPaciente('Maria Silva', 'Maria Aparecida da Silva')).toBe(2);
    expect(pontosDoPaciente('M. A. S.', 'Maria Aparecida da Silva')).toBe(2);
    expect(pontosDoPaciente('MAS', 'Maria Aparecida Silva')).toBe(2);
    expect(pontosDoPaciente('MS', 'Maria Aparecida Silva')).toBe(2);
    expect(pontosDoPaciente('José Antônio Souza', 'Jose Antonio Souza')).toBe(3);
    // "E" é inicial, não a partícula "e".
    expect(pontosDoPaciente('ESM', 'E. S. M.')).toBe(2);
    expect(pontosDoPaciente('E. S. M.', 'Elaine Souza e Melo')).toBe(2);
  });

  it('não confunde pessoas diferentes', () => {
    expect(pontosDoPaciente('Maria Silva', 'Maria Souza')).toBe(1);
    expect(pontosDoPaciente('M. A. S.', 'João Pedro Rocha')).toBe(0);
    expect(pontosDoPaciente('', 'Maria')).toBe(0);
  });
});

describe('cruzamento do demonstrativo com as cirurgias', () => {
  const cirurgias = [cir('c1', '2026-10-05', 'M. A. S.'), cir('c2', '2026-10-09', 'J. P. R.'), cir('c3', '2026-10-12', 'L. M. N.')];

  it('liga cada linha à cirurgia certa e deixa de fora o que o hospital não listou', () => {
    const itens = casarItens(
      [
        { data: '2026-10-05', paciente: 'Maria Aparecida Silva' },
        { data: '2026-10-10', paciente: 'J.P.R.' }, // um dia de diferença
      ],
      cirurgias,
      'h1',
    );
    expect(itens.map((i) => i.cirurgia_id)).toEqual(['c1', 'c2']);
  });

  it('não liga quando a data está longe, o hospital é outro ou a cirurgia já foi paga', () => {
    expect(casarItens([{ data: '2026-10-20', paciente: 'M. A. S.' }], cirurgias, 'h1')[0]!.cirurgia_id).toBeNull();
    expect(casarItens([{ data: '2026-10-05', paciente: 'M. A. S.' }], cirurgias, 'h2')[0]!.cirurgia_id).toBeNull();
    const pagas = cirurgias.map((c) => ({ ...c, demonstrativo_id: 'dx' }));
    expect(casarItens([{ data: '2026-10-05', paciente: 'M. A. S.' }], pagas, 'h1')[0]!.cirurgia_id).toBeNull();
  });

  it('não usa a mesma cirurgia para duas linhas', () => {
    const itens = casarItens(
      [
        { data: '2026-10-05', paciente: 'M. A. S.' },
        { data: '2026-10-05', paciente: 'M. A. S.' },
      ],
      cirurgias,
      'h1',
    );
    expect(itens.filter((i) => i.cirurgia_id === 'c1')).toHaveLength(1);
    expect(itens.filter((i) => i.cirurgia_id === null)).toHaveLength(1);
  });

  it('sem data na linha, só liga com nome idêntico', () => {
    expect(casarItens([{ data: null, paciente: 'M. A. S.' }], cirurgias, 'h1')[0]!.cirurgia_id).toBe('c1');
    expect(casarItens([{ data: null, paciente: 'Maria Aparecida Silva' }], cirurgias, 'h1')[0]!.cirurgia_id).toBeNull();
  });
});

describe('pendências, avisos e resumo', () => {
  it('pendência é a cirurgia sem demonstrativo; atrasada passa do prazo do hospital', () => {
    const lista = pendencias([cir('c1', '2026-10-01', 'A. B.'), cir('c2', '2026-11-20', 'C. D.'), cir('c3', '2026-10-01', 'E. F.', { demonstrativo_id: 'd1' })], [H], HOJE);
    expect(lista.map((p) => [p.cirurgia.id, p.atrasada])).toEqual([
      ['c1', true],
      ['c2', false],
    ]);
  });

  it('guarda o histórico da cobrança: o hospital não responde, então o que continua em aberto volta para cobrar', () => {
    const [nunca, recente, antiga] = pendencias(
      [
        cir('a', '2026-09-01', 'A. B.'),
        cir('b', '2026-09-02', 'C. D.', { cobrancas: ['2026-11-10'], cobrada_em: '2026-11-10' }),
        cir('c', '2026-09-03', 'E. F.', { cobrancas: ['2026-09-20', '2026-10-20'], cobrada_em: '2026-10-20' }),
      ],
      [H],
      HOJE,
    );
    expect([nunca!.vezes, nunca!.diasSemResposta, nunca!.cobrarAgora]).toEqual([0, null, true]);
    // Cobrada há 14 dias: ainda aguarda o hospital.
    expect([recente!.vezes, recente!.diasSemResposta, recente!.cobrarAgora]).toEqual([1, 14, false]);
    // Duas cobranças, a última há 35 dias sem resposta: cobrar de novo.
    expect([antiga!.vezes, antiga!.diasSemResposta, antiga!.cobrarAgora]).toEqual([2, 35, true]);

    const sAguardando = avisos([], [cir('b', '2026-09-02', 'C. D.', { cobrancas: ['2026-11-10'] })], [H], HOJE);
    expect(sAguardando[0]).toMatchObject({ gravidade: 'media' });
    expect(sAguardando[0]!.texto).toContain('aguardando o hospital');
    const sReenviar = avisos([], [cir('c', '2026-09-03', 'E. F.', { cobrancas: ['2026-10-20'] })], [H], HOJE);
    expect(sReenviar[0]).toMatchObject({ gravidade: 'alta' });
    expect(sReenviar[0]!.texto).toContain('cobrar de novo');
  });

  it('etapa vem das datas', () => {
    expect(etapaDe(dem())).toBe('recebido');
    expect(etapaDe(dem({ nota_pedida_em: '2026-11-21' }))).toBe('nota_pedida');
    expect(etapaDe(dem({ nota_pedida_em: '2026-11-21', nota_emitida_em: '2026-11-22' }))).toBe('nota_emitida');
    expect(etapaDe(dem({ nota_enviada_em: '2026-11-22' }))).toBe('nota_enviada');
    expect(etapaDe(dem({ pago_em: '2026-11-23' }))).toBe('pago');
  });

  it('avisa nota parada, pagamento atrasado e cirurgia não paga, do mais grave para o menos', () => {
    const fila = avisos(
      [
        dem({ id: 'a', recebido_em: '2026-11-23' }), // chegou ontem: média
        dem({ id: 'b', nota_pedida_em: '2026-10-01', nota_emitida_em: '2026-10-02', nota_enviada_em: '2026-10-03' }), // 52 dias sem pagar
        dem({ id: 'c', pago_em: '2026-11-01' }), // pago: sem aviso
        dem({ id: 'd', nota_pedida_em: '2026-11-23' }), // contador dentro do prazo: sem aviso
      ],
      [cir('c1', '2026-09-01', 'A. B.', { hospital_id: 'h2' })],
      [H, H2],
      HOJE,
    );
    expect(fila.map((a) => [a.demonstrativo_id ?? a.tipo, a.gravidade])).toEqual([
      ['pendencia', 'alta'],
      ['b', 'alta'],
      ['a', 'media'],
    ]);
    expect(fila[0]!.texto).toContain('CHN');
  });

  it('resumo soma a receber, recebido no mês e pago a menos', () => {
    const r = resumo(
      [dem({ valor_total: 6000 }), dem({ id: 'p', valor_total: 5000, pago_em: '2026-11-10', valor_pago: 4600 }), dem({ id: 'v', valor_total: 1000, pago_em: '2026-10-10' })],
      [cir('c1', '2026-11-01', 'A. B.'), cir('c2', '2026-11-02', 'C. D.', { valor: null })],
      HOJE,
    );
    expect(r).toEqual({ aReceber: 6000, recebidoNoMes: 4600, pendentes: 2, valorPendente: 3000, pagoAMenos: 400 });
  });
});

describe('textos prontos', () => {
  it('pedido de nota e cobrança saem com os dados e sem travessão', () => {
    const config = { ...CONFIG_VAZIA, medico_nome: 'Dr. Teste', contador_nome: 'Paula', contador_email: 'paula@c.com' };
    const pedido = pedidoDeNota(dem({ itens: [{ data: '2026-10-05', paciente: 'M. A. S.', procedimento: 'Colecistectomia', convenio: 'Unimed', valor: 3000, cirurgia_id: null }] }), H, config);
    expect(pedido.para).toBe('paula@c.com');
    expect(pedido.corpo).toContain('R$');
    expect(pedido.corpo).toContain('05/10/2026');
    // O contador não precisa do nome do paciente para emitir a nota.
    expect(pedido.corpo).not.toContain('M. A. S.');

    const c = cobranca([cir('c2', '2026-10-09', 'J. P. R.'), cir('c1', '2026-10-05', 'M. A. S.')], H, config);
    expect(c.assunto).toContain('2 cirurgias sem pagamento');
    expect(c.corpo).toContain('planilha de levantamento de pendências');
    // A lista de pacientes vai na planilha anexa, não no corpo do e-mail.
    expect(c.corpo).not.toContain('J. P. R.');
    for (const t of [pedido.corpo, pedido.assunto, c.corpo, c.assunto]) expect(t).not.toMatch(/[—–]/);
    expect(mailto(c)).toMatch(/^mailto:repasse%40h\.com\?subject=/);
  });
});

describe('exemplo e acesso', () => {
  it('o exemplo deixa cirurgias de fora dos demonstrativos (é o que a tela mostra como pendência)', () => {
    const ex = dadosDeExemplo(HOJE);
    const noDemonstrativo = new Set(ex.demonstrativos.flatMap((d) => d.itens.map((i) => `${d.hospital}|${i.paciente}`)));
    const fora = ex.cirurgias.filter((c) => !noDemonstrativo.has(`${c.hospital}|${c.paciente}`));
    expect(fora.map((c) => c.paciente)).toEqual(expect.arrayContaining(['L. M. N.', 'P. H. S.']));
    expect(ex.demonstrativos.every((d) => d.itens.length > 0)).toBe(true);
    expect(ex.cirurgias.every((c) => c.data <= HOJE)).toBe(true);
  });

  it('só entra quem foi liberado ou é super admin', () => {
    expect(areaMedicaLiberada('alexandre@b2supply.com')).toBe(true);
    expect(areaMedicaLiberada(' Alexandre@B2Supply.com ')).toBe(true);
    expect(areaMedicaLiberada('cliente@empresa.com')).toBe(false);
    expect(areaMedicaLiberada('cliente@empresa.com', true)).toBe(true);
    expect(areaMedicaLiberada(null)).toBe(false);
  });

  it('a conta de médico entra pela Área Médica e só nela', () => {
    // O tipo de conta libera, sem depender da lista de e-mails.
    expect(areaMedicaLiberada('medico@clinica.com', false, 'medico')).toBe(true);
    expect(areaMedicaLiberada('pessoa@2bsupply.com.br', false, 'equipe')).toBe(true);
    expect(areaMedicaLiberada('cliente@empresa.com', false, '')).toBe(false);
    // Só 'medico' fica preso à Área Médica; equipe e conta comum usam o resto.
    expect([soAreaMedica('medico'), soAreaMedica('equipe'), soAreaMedica(''), soAreaMedica(undefined)]).toEqual([true, false, false, false]);
    expect(caminhoDoMedico('/area-medica')).toBe(true);
    expect(caminhoDoMedico('/area-medica/qualquer')).toBe(true);
    for (const fora of ['/chat', '/assistants/kraljic', '/painel', '/area-medicamentos', '/profile']) expect(caminhoDoMedico(fora)).toBe(false);
  });
});
