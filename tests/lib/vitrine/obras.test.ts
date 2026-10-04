import { describe, expect, it } from 'vitest';

import {
  CONTRATOS,
  OBRAS,
  contratoPorId,
  obraPorId,
  indicadoresCockpit,
  linhasDaMedicao,
  medidoPorMes,
  precoUnitarioFinal,
  resumoDaObra,
  rotuloMes,
  valorDaMedicao,
  valorPlanilha,
  valorPorGrupo,
} from '@/lib/vitrine/obras';

const NOW = new Date(2026, 9, 4);

describe('preço unitário final', () => {
  it('aplica BDI e depois o desconto da licitação', () => {
    // 100 × 1,25 × 0,96 = 120
    expect(precoUnitarioFinal(100, 0.25, 0.04)).toBe(120);
    expect(precoUnitarioFinal(450, 0, 0)).toBe(450);
  });
});

describe('dados de exemplo', () => {
  it('toda obra aponta para um contrato existente e tem planilha', () => {
    for (const o of OBRAS) {
      expect(contratoPorId(o.contratoId), o.id).toBeDefined();
      expect(o.servicos.length, o.id).toBeGreaterThan(0);
      for (const s of o.servicos) expect(o.grupos.some((g) => g.item === s.grupo), `${o.id} ${s.item}`).toBe(true);
    }
  });

  it('nenhuma medição passa de 100% de um grupo (acumulado)', () => {
    for (const o of OBRAS) {
      for (const g of o.grupos) {
        const total = o.medicoes.reduce((s, m) => s + (m.avanco[g.item] ?? 0), 0);
        expect(total, `${o.id} grupo ${g.item}`).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('BMs são numerados em sequência e em meses crescentes', () => {
    for (const o of OBRAS) {
      o.medicoes.forEach((m, i) => {
        expect(m.numero).toBe(i + 1);
        if (i > 0) expect(m.mes).toBeGreaterThan(o.medicoes[i - 1]!.mes);
      });
    }
  });

  it('a obra concluída está 100% medida', () => {
    const concluida = OBRAS.find((o) => o.status === 'CONCLUIDA')!;
    const resumo = resumoDaObra(concluida, contratoPorId(concluida.contratoId)!, NOW);
    expect(resumo.avanco).toBe(100);
    expect(resumo.saldo).toBe(0);
    expect(resumo.diasRestantes).toBeNull();
  });
});

describe('cálculos da obra', () => {
  const obra = obraPorId('ob-1');
  const contrato = contratoPorId(obra.contratoId)!;

  it('a soma dos grupos é o total da planilha', () => {
    const porGrupo = valorPorGrupo(obra, contrato).reduce((s, g) => s + g.valor, 0);
    expect(porGrupo).toBeCloseTo(valorPlanilha(obra, contrato), 1);
  });

  it('anterior + desta medição = acumulado, linha a linha', () => {
    for (const m of obra.medicoes) {
      for (const l of linhasDaMedicao(obra, contrato, m.numero)) {
        expect(l.quantidadeAnterior + l.quantidadeMedicao).toBeCloseTo(l.quantidadeAcumulada, 2);
        expect(l.quantidadeAcumulada).toBeLessThanOrEqual(l.servico.quantidade + 0.01);
      }
    }
  });

  it('o acumulado do último BM é o anterior dele + ele mesmo', () => {
    const ultimo = obra.medicoes[obra.medicoes.length - 1]!.numero;
    const penultimo = ultimo - 1;
    const acumPenultimo = linhasDaMedicao(obra, contrato, penultimo);
    const linhasUltimo = linhasDaMedicao(obra, contrato, ultimo);
    linhasUltimo.forEach((l, i) => expect(l.quantidadeAnterior).toBeCloseTo(acumPenultimo[i]!.quantidadeAcumulada, 2));
  });

  it('BM inexistente devolve vazio', () => {
    expect(linhasDaMedicao(obra, contrato, 99)).toEqual([]);
  });

  it('rascunho não entra no medido da obra', () => {
    const rascunho = obra.medicoes.find((m) => m.status === 'RASCUNHO')!;
    const resumo = resumoDaObra(obra, contrato, NOW);
    const todos = obra.medicoes.reduce((s, m) => s + valorDaMedicao(obra, contrato, m.numero), 0);
    expect(resumo.valorMedido).toBeCloseTo(todos - valorDaMedicao(obra, contrato, rascunho.numero), 1);
  });
});

describe('cockpit', () => {
  const ind = indicadoresCockpit(OBRAS, CONTRATOS, NOW);

  it('soma a carteira inteira e é coerente', () => {
    const contratado = OBRAS.reduce((s, o) => s + valorPlanilha(o, contratoPorId(o.contratoId)!), 0);
    expect(ind.valorContratado).toBeCloseTo(contratado, 1);
    expect(ind.saldoAMedir).toBeCloseTo(ind.valorContratado - ind.valorMedido, 1);
    expect(ind.obrasEmExecucao).toBe(OBRAS.filter((o) => o.status === 'ATIVA').length);
    expect(ind.contratosAtivos).toBe(3);
    expect(ind.aguardandoAprovacao).toBeGreaterThan(0);
  });

  it('a série mensal cobre os últimos 6 meses e soma ao medido dentro da janela', () => {
    const serie = medidoPorMes(OBRAS, CONTRATOS, NOW, 6);
    expect(serie.map((p) => p.rotulo)).toEqual(['mai/26', 'jun/26', 'jul/26', 'ago/26', 'set/26', 'out/26']);
    // mês atual só tem rascunhos → zero
    expect(serie[5]?.valor).toBe(0);
    expect(serie.slice(0, 5).every((p) => p.valor > 0)).toBe(true);
  });

  it('rótulo de mês atravessa a virada de ano', () => {
    expect(rotuloMes(new Date(2026, 0, 10), -1)).toBe('dez/25');
  });
});
