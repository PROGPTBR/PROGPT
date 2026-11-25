import { describe, expect, it } from 'vitest';

import { avisos, pendencias } from '@/lib/medico/conciliacao';
import { estadoDeExemplo } from '@/lib/medico/exemplo';
import { lerExtrato, placarDaConciliacao, sugerirPagamentos } from '@/lib/medico/extrato';
import { previsaoDoMes, relatorioDaSemana } from '@/lib/medico/previsao';
import { lerRegua, pontosDaRegua, proximaCobranca, reguaDo, reguaTexto, vencimentoDa } from '@/lib/medico/regua';
import { type Cirurgia, type Demonstrativo, type Hospital } from '@/lib/medico/types';

const HOJE = '2026-11-24';
const H: Hospital = { id: 'h1', nome: "Niterói D'Or", email: 'repasse@h.com', prazo_pagamento_dias: 30, exemplo: false };

function cir(id: string, data: string, extra: Partial<Cirurgia> = {}): Cirurgia {
  return { id, hospital_id: 'h1', data, paciente: 'A. B.', procedimento: 'Colecistectomia', convenio: 'Unimed', valor: 3000, origem: 'manual', demonstrativo_id: null, cobrada_em: null, funcao: '', registro: '', hora: '', cobrancas: [], observacao: '', exemplo: false, ...extra };
}

function dem(extra: Partial<Demonstrativo> = {}): Demonstrativo {
  return { id: 'd1', hospital_id: 'h1', referencia: 'outubro/2026', recebido_em: '2026-11-20', valor_total: 6000, itens: [], nota_pedida_em: null, nota_numero: '', nota_emitida_em: null, nota_enviada_em: null, pago_em: null, valor_pago: null, exemplo: false, tipo: 'hospital', pagador_nome: '', pagador_documento: '', pagador_contato: '', ...extra };
}

describe('régua de cobrança', () => {
  it('limpa a régua do cadastro e cai no padrão quando não há nada', () => {
    expect(reguaDo(null)).toEqual([0, 15, 30]);
    expect(reguaDo({ regua: [] })).toEqual([0, 15, 30]);
    expect(reguaDo({ regua: [0, 7, 15, 30, 400, -1] })).toEqual([0, 7, 15, 30]);
    expect(lerRegua('0; 7, 15  30')).toEqual([0, 7, 15, 30]);
    expect(lerRegua('abc')).toEqual([0, 15, 30]);
    expect(reguaTexto([0, 7])).toBe('0, 7');
  });

  it('o vencimento é o prazo do demonstrativo, ou o dia em que ele chegou sem a cirurgia', () => {
    const c = cir('a', '2026-10-08');
    expect(vencimentoDa(c, [], H)).toBe('2026-12-10');
    const semEla = dem({ recebido_em: '2026-11-20', itens: [{ data: '2026-10-03', paciente: 'X', procedimento: '', convenio: '', valor: 1, cirurgia_id: 'outra' }] });
    expect(vencimentoDa(c, [semEla], H)).toBe('2026-11-20');
  });

  it('o primeiro número conta do vencimento; os seguintes, da cobrança anterior; acabou, repete o último', () => {
    const regua = [0, 15, 30];
    expect(proximaCobranca('2026-11-10', [], regua)).toMatchObject({ etapa: 0, proxima: '2026-11-10', rotulo: 'Vence' });
    expect(proximaCobranca('2026-11-10', ['2026-11-10'], regua)).toMatchObject({ etapa: 1, proxima: '2026-11-25', rotulo: '+15 d' });
    expect(proximaCobranca('2026-11-10', ['2026-11-10', '2026-11-25'], regua)).toMatchObject({ etapa: 2, proxima: '2026-12-25', rotulo: '+30 d' });
    // Quarta cobrança: a régua acabou, repete os 30 dias.
    expect(proximaCobranca('2026-11-10', ['2026-11-10', '2026-11-25', '2026-12-25'], regua)).toMatchObject({ etapa: 3, proxima: '2027-01-24', rotulo: '+30 d' });
    // Régua que espera 3 dias antes da primeira cobrança.
    expect(proximaCobranca('2026-11-10', [], [3, 7]).proxima).toBe('2026-11-13');
  });

  it('a régua do hospital decide quando cobrar de novo', () => {
    const apressado: Hospital = { ...H, regua: [0, 7] };
    const [p] = pendencias([cir('b', '2026-09-02', { cobrancas: ['2026-11-10'] })], [apressado], HOJE);
    // Cobrada há 14 dias, régua de 7: já passou da hora.
    expect(p).toMatchObject({ etapa: 1, proxima: '2026-11-17', cobrarAgora: true, rotulo: '+7 d' });
    const [q] = pendencias([cir('b', '2026-09-02', { cobrancas: ['2026-11-10'] })], [H], HOJE);
    expect(q).toMatchObject({ etapa: 1, proxima: '2026-11-25', cobrarAgora: false });
  });

  it('conta as pendências em cada ponto da régua, e o excedente cai no último', () => {
    const pontos = pontosDaRegua([0, 15, 30], [
      { etapa: 0, valor: 100 },
      { etapa: 0, valor: null },
      { etapa: 2, valor: 50 },
      { etapa: 5, valor: 10 },
    ]);
    expect(pontos.map((p) => [p.rotulo, p.quantas, p.valor])).toEqual([
      ['Vence', 2, 100],
      ['+15 d', 0, 0],
      ['+30 d', 2, 60],
    ]);
  });

  it('avisa quando a nota enviada está perto de vencer (D-3)', () => {
    const quaseVencendo = dem({ nota_pedida_em: '2026-10-20', nota_emitida_em: '2026-10-22', nota_enviada_em: '2026-10-27' }); // 28 dias: vence em 2
    const noDia = dem({ id: 'd2', nota_pedida_em: '2026-10-20', nota_emitida_em: '2026-10-22', nota_enviada_em: '2026-10-25' }); // 30 dias: vence hoje
    const longe = dem({ id: 'd3', nota_pedida_em: '2026-11-10', nota_emitida_em: '2026-11-12', nota_enviada_em: '2026-11-15' });
    const textos = avisos([quaseVencendo, noDia, longe], [], [H], HOJE).map((a) => a.texto);
    expect(textos).toContain("Niterói D'Or: pagamento vence em 2 dias");
    expect(textos).toContain("Niterói D'Or: pagamento vence hoje");
    expect(textos).toHaveLength(2);
  });
});

describe('conciliação bancária', () => {
  it('fecha o placar: certas, para revisar, sem nota e notas sem crédito', () => {
    const notas = [
      dem({ id: 'n1', valor_total: 6000, nota_emitida_em: '2026-11-01', nota_enviada_em: '2026-11-02' }),
      dem({ id: 'n2', valor_total: 4000, nota_emitida_em: '2026-11-01', nota_enviada_em: '2026-11-02' }),
      dem({ id: 'n3', valor_total: 2500, nota_emitida_em: '2026-11-01', nota_enviada_em: '2026-11-02' }),
    ];
    const creditos = lerExtrato(['data;descricao;valor', '20/11/2026;PIX NITEROI DOR;6.000,00', '21/11/2026;TED NITEROI DOR LTDA;3.700,00', '22/11/2026;TRANSF PROPRIA;500,00'].join('\n'));
    const sugestoes = sugerirPagamentos(creditos, notas, [H]);
    const placar = placarDaConciliacao(creditos, sugestoes, notas);
    expect(placar).toEqual({ creditos: 3, certas: 1, provaveis: 1, semPar: 1, notasSemCredito: 1, valorConciliado: 9700 });
  });
});

describe('previsão do mês e relatório da semana', () => {
  it('pondera cada nota em aberto pela etapa e soma o que já caiu', () => {
    const p = previsaoDoMes(
      {
        hospitais: [H],
        cirurgias: [],
        demonstrativos: [
          dem({ id: 'paga', valor_total: 1000, pago_em: '2026-11-10', valor_pago: 900 }),
          dem({ id: 'enviada', valor_total: 2000, nota_pedida_em: '2026-11-01', nota_emitida_em: '2026-11-02', nota_enviada_em: '2026-11-03' }), // cai em 03/12: fora do mês
          dem({ id: 'recebida', valor_total: 4000, recebido_em: '2026-11-22' }),
        ],
      },
      HOJE,
    );
    expect(p.recebido).toBe(900);
    expect(p.totalEmAberto).toBe(6000);
    expect(p.totalPonderado).toBe(2000 * 0.9 + 4000 * 0.5);
    // Nenhuma das duas cai até 30/11 (a enviada vence 03/12; a recebida ainda vai virar nota).
    expect(p.ponderadoNoMes).toBe(0);
    expect(p.esperadoNoMes).toBe(900);
    expect(p.funil.map((f) => [f.etapa, f.notas])).toEqual([
      ['nota_enviada', 1],
      ['recebido', 1],
    ]);
    expect(p.ranking[0]).toMatchObject({ hospital_id: 'h1', aReceber: 6000, recebido: 900 });
  });

  it('o relatório da semana sai sem nome de paciente e com os números do exemplo', () => {
    const estado = estadoDeExemplo(HOJE);
    const texto = relatorioDaSemana(estado, HOJE);
    expect(texto).toContain('Resumo da semana');
    expect(texto).toContain('Esperado no mês');
    expect(texto).toContain('Por hospital');
    for (const c of estado.cirurgias) {
      if (c.paciente.length > 6) expect(texto).not.toContain(c.paciente);
    }
  });
});
