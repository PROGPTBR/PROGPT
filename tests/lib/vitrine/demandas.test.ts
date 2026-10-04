import { describe, expect, it } from 'vitest';

import { diasEntre, hojeEmBrasilia, isoDia } from '@/lib/vitrine/datas';
import {
  PESSOAS,
  SETORES,
  calcularIndicadores,
  calcularPrazo,
  colunaDoFluxo,
  contarPorSetor,
  contarPorStatus,
  etapaDoCiclo,
  formatarCodigo,
  montarDemandasExemplo,
  type Sp,
} from '@/lib/vitrine/demandas';

const HOJE = new Date(2026, 9, 4); // 04/10/2026
const HOJE_ISO = '2026-10-04';

const sp = (over: Partial<Sp>): Sp =>
  ({ status: 'em_andamento', dataPrevista: HOJE_ISO, recebida: true, percentual: 10, ...over }) as Sp;

describe('datas', () => {
  it('isoDia desloca no calendário local, atravessando mês', () => {
    expect(isoDia(HOJE, 0)).toBe('2026-10-04');
    expect(isoDia(HOJE, -4)).toBe('2026-09-30');
    expect(isoDia(HOJE, 28)).toBe('2026-11-01');
  });

  it('diasEntre conta dias de calendário', () => {
    expect(diasEntre('2026-10-04', '2026-10-09')).toBe(5);
    expect(diasEntre('2026-10-04', '2026-10-01')).toBe(-3);
  });

  it('hojeEmBrasilia usa o fuso de São Paulo, não o do servidor', () => {
    // 02:00 UTC do dia 5 ainda é dia 4 em Brasília (UTC-3).
    expect(hojeEmBrasilia(new Date('2026-10-05T02:00:00Z'))).toBe('2026-10-04');
    expect(hojeEmBrasilia(new Date('2026-10-05T12:00:00Z'))).toBe('2026-10-05');
  });
});

describe('calcularPrazo (semáforo portado do sistema de origem)', () => {
  it('atraso fica vermelho com a contagem de dias', () => {
    expect(calcularPrazo(sp({ dataPrevista: '2026-10-01' }), HOJE_ISO)).toMatchObject({
      tom: 'vermelho',
      label: '3 dias em atraso',
      atrasada: true,
    });
    expect(calcularPrazo(sp({ dataPrevista: '2026-10-03' }), HOJE_ISO).label).toBe('1 dia em atraso');
  });

  it('vence hoje e dentro da janela de atenção ficam amarelos', () => {
    expect(calcularPrazo(sp({ dataPrevista: HOJE_ISO }), HOJE_ISO)).toMatchObject({ tom: 'amarelo', label: 'Vence hoje' });
    expect(calcularPrazo(sp({ dataPrevista: '2026-10-09' }), HOJE_ISO)).toMatchObject({ tom: 'amarelo', dias: 5 });
    expect(calcularPrazo(sp({ dataPrevista: '2026-10-10' }), HOJE_ISO).tom).toBe('verde');
  });

  it('concluída e cancelada nunca contam como atraso', () => {
    expect(calcularPrazo(sp({ status: 'concluida', dataPrevista: '2026-01-01' }), HOJE_ISO).atrasada).toBe(false);
    expect(calcularPrazo(sp({ status: 'cancelada', dataPrevista: '2026-01-01' }), HOJE_ISO).tom).toBe('neutro');
  });
});

describe('ciclo de vida e quadro de fluxo', () => {
  it('posiciona cada status no ciclo; cancelada fica fora', () => {
    expect(etapaDoCiclo('aberta')).toBe(0);
    expect(etapaDoCiclo('aguardando_resposta')).toBe(1);
    expect(etapaDoCiclo('aguardando_validacao')).toBe(2);
    expect(etapaDoCiclo('concluida')).toBe(3);
    expect(etapaDoCiclo('cancelada')).toBe(-1);
  });

  it('a coluna deriva de status + recebimento (o cartão anda sozinho)', () => {
    expect(colunaDoFluxo(sp({ status: 'aberta', recebida: false, percentual: 0 }))).toBe('enviada');
    expect(colunaDoFluxo(sp({ status: 'aberta', recebida: true, percentual: 0 }))).toBe('recebida');
    expect(colunaDoFluxo(sp({ status: 'aberta', recebida: true, percentual: 20 }))).toBe('em_andamento');
    expect(colunaDoFluxo(sp({ status: 'aguardando_resposta' }))).toBe('em_andamento');
    expect(colunaDoFluxo(sp({ status: 'aguardando_validacao' }))).toBe('aguardando_validacao');
    expect(colunaDoFluxo(sp({ status: 'concluida' }))).toBe('concluida');
    expect(colunaDoFluxo(sp({ status: 'cancelada' }))).toBeNull();
  });

  it('formata o código no padrão SP-SETOR-NN/ANO', () => {
    expect(formatarCodigo('SP', 'MKT', 8, 2026)).toBe('SP-MKT-08/2026');
  });
});

describe('dados de exemplo', () => {
  const sps = montarDemandasExemplo(HOJE);

  it('todas as referências a setor e pessoa existem', () => {
    const setores = new Set(SETORES.map((s) => s.slug));
    const pessoas = new Set(PESSOAS.map((p) => p.id));
    for (const s of sps) {
      expect(setores.has(s.setor), s.id).toBe(true);
      for (const id of [s.solicitante, s.emissor, ...s.responsaveis, ...s.eventos.map((e) => e.pessoa)]) {
        expect(pessoas.has(id), `${s.id}: ${id}`).toBe(true);
      }
    }
  });

  it('códigos são únicos e usam o ano corrente', () => {
    const codigos = sps.map((s) => s.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(codigos.every((c) => c.endsWith('/2026'))).toBe(true);
  });

  it('concluídas têm data de conclusão e 100%; as demais não têm conclusão', () => {
    for (const s of sps) {
      if (s.status === 'concluida') {
        expect(s.dataConclusao, s.id).not.toBeNull();
        expect(s.percentual, s.id).toBe(100);
      } else {
        expect(s.dataConclusao, s.id).toBeNull();
      }
    }
  });

  it('a demo sempre mostra exemplos de todos os semáforos, em qualquer dia', () => {
    const tons = new Set(sps.map((s) => calcularPrazo(s, HOJE_ISO).tom));
    expect([...tons].sort()).toEqual(['amarelo', 'neutro', 'verde', 'vermelho']);
    // e a mesma montagem num outro "hoje" mantém a proporção (datas relativas)
    const outroHoje = new Date(2027, 2, 15);
    const outras = montarDemandasExemplo(outroHoje);
    const atrasadasAqui = sps.filter((s) => calcularPrazo(s, HOJE_ISO).atrasada).length;
    const atrasadasLa = outras.filter((s) => calcularPrazo(s, '2027-03-15').atrasada).length;
    expect(atrasadasLa).toBe(atrasadasAqui);
  });

  it('indicadores batem com a contagem dos exemplos', () => {
    const ind = calcularIndicadores(sps, HOJE_ISO);
    expect(ind.total).toBe(sps.length);
    expect(ind.abertas + ind.emAndamento + ind.aguardandoValidacao + ind.concluidas).toBe(
      sps.filter((s) => s.status !== 'cancelada').length,
    );
    expect(ind.emAtraso).toBe(4);
    // 4 das 6 concluídas foram entregues até a data prevista
    expect(ind.conclusaoNoPrazo).toBe(67);
    expect(ind.tempoMedioDias).toBeGreaterThan(0);

    expect(contarPorStatus(sps).reduce((a, p) => a + p.total, 0)).toBe(sps.length);
    const porSetor = contarPorSetor(sps, SETORES, HOJE_ISO);
    expect(porSetor.reduce((a, p) => a + p.total, 0)).toBe(sps.length);
    expect(porSetor.reduce((a, p) => a + p.atrasadas, 0)).toBe(ind.emAtraso);
  });

  it('sem concluídas, os indicadores de conclusão ficam vazios (não 0)', () => {
    const ind = calcularIndicadores(sps.filter((s) => s.status !== 'concluida'), HOJE_ISO);
    expect(ind.conclusaoNoPrazo).toBeNull();
    expect(ind.tempoMedioDias).toBeNull();
  });
});
