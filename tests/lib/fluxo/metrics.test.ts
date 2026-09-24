import { describe, expect, it } from 'vitest';

import { DIAS_PARA_ALERTA, construirPainel } from '@/lib/fluxo/metrics';
import type { FluxoEtapa, FluxoProcesso } from '@/lib/fluxo/types';

// Painel de gestão dos processos — pedido de cliente em 24/09/2026:
// "dashboards de atendimentos, SLA e etc".
//
// `agora` é sempre explícito: um painel de SLA que usa Date.now() por dentro
// vira teste que muda de resultado conforme o dia.

const AGORA = new Date('2026-09-24T12:00:00Z').getTime();
const dia = (n: number) => new Date(AGORA - n * 24 * 60 * 60 * 1000).toISOString();

function processo(over: Partial<FluxoProcesso> = {}): FluxoProcesso {
  return {
    id: 'p1',
    user_id: 'u1',
    titulo: 'Compra de notebooks',
    requisicao: '10 notebooks',
    etapa_atual: 'solicitacao',
    status: 'em_andamento',
    contexto: {},
    created_at: dia(1),
    updated_at: dia(1),
    ...over,
  };
}

function etapa(over: Partial<FluxoEtapa> = {}): FluxoEtapa {
  return {
    id: 'e1',
    processo_id: 'p1',
    user_id: 'u1',
    etapa: 'solicitacao',
    rodada: 1,
    saida: {
      resumo: '', campos: [], itens: [], pontos_de_revisao: [], alertas: [], saida: '',
    },
    decisao: 'siga',
    observacao: null,
    decidida_em: dia(1),
    created_at: dia(1),
    ...over,
  };
}

describe('painel vazio', () => {
  it('não inventa número quando não há processo', () => {
    const p = construirPainel({ processos: [], etapas: [], agora: AGORA });
    expect(p.totalProcessos).toBe(0);
    expect(p.cicloMedioDias).toBeNull();
    expect(p.parados).toEqual([]);
    expect(p.etapas).toHaveLength(8);
  });
});

describe('contagens', () => {
  it('separa em andamento de concluído', () => {
    const p = construirPainel({
      processos: [
        processo({ id: 'a' }),
        processo({ id: 'b', status: 'concluido' }),
        processo({ id: 'c', status: 'cancelado' }),
      ],
      etapas: [],
      agora: AGORA,
    });
    expect(p.emAndamento).toBe(1);
    expect(p.concluidos).toBe(1);
    expect(p.totalProcessos).toBe(3);
  });

  it('mostra em que etapa cada compra está parada', () => {
    const p = construirPainel({
      processos: [
        processo({ id: 'a', etapa_atual: 'rfq' }),
        processo({ id: 'b', etapa_atual: 'rfq' }),
        processo({ id: 'c', etapa_atual: 'po' }),
      ],
      etapas: [],
      agora: AGORA,
    });
    const rfq = p.etapas.find((e) => e.etapa === 'rfq')!;
    const po = p.etapas.find((e) => e.etapa === 'po')!;
    expect(rfq.emAndamento).toBe(2);
    expect(po.emAndamento).toBe(1);
  });

  it('conta só processo ABERTO no funil (concluído não fica parado em etapa)', () => {
    const p = construirPainel({
      processos: [processo({ id: 'a', etapa_atual: 'po', status: 'concluido' })],
      etapas: [],
      agora: AGORA,
    });
    expect(p.etapas.find((e) => e.etapa === 'po')!.emAndamento).toBe(0);
  });
});

describe('ciclo médio', () => {
  it('mede da abertura até a conclusão, só dos concluídos', () => {
    const p = construirPainel({
      processos: [
        processo({ id: 'a', status: 'concluido', created_at: dia(10), updated_at: dia(4) }),
        processo({ id: 'b', status: 'concluido', created_at: dia(8), updated_at: dia(4) }),
        // aberto há 30 dias: não pode puxar a média
        processo({ id: 'c', created_at: dia(30) }),
      ],
      etapas: [],
      agora: AGORA,
    });
    expect(p.cicloMedioDias).toBe(5); // (6 + 4) / 2
  });
});

describe('compras paradas', () => {
  it('sinaliza as que não andam há DIAS_PARA_ALERTA ou mais', () => {
    const p = construirPainel({
      processos: [
        processo({ id: 'velho', created_at: dia(9), updated_at: dia(9) }),
        processo({ id: 'novo', created_at: dia(1), updated_at: dia(1) }),
      ],
      etapas: [],
      agora: AGORA,
    });
    expect(p.parados.map((x) => x.id)).toEqual(['velho']);
    expect(p.parados[0]!.diasParado).toBe(9);
  });

  it('ordena da mais parada para a menos', () => {
    const p = construirPainel({
      processos: [
        processo({ id: 'a', created_at: dia(6), updated_at: dia(4) }),
        processo({ id: 'b', created_at: dia(25), updated_at: dia(20) }),
        processo({ id: 'c', created_at: dia(9), updated_at: dia(7) }),
      ],
      etapas: [],
      agora: AGORA,
    });
    expect(p.parados.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('uma execução recente conta como atividade, mesmo com o processo antigo', () => {
    const p = construirPainel({
      processos: [processo({ id: 'p1', created_at: dia(30), updated_at: dia(30) })],
      etapas: [etapa({ created_at: dia(1), decidida_em: null, decisao: 'pendente' })],
      agora: AGORA,
    });
    expect(p.parados).toEqual([]);
  });

  it('marca quando a compra está esperando decisão humana', () => {
    const p = construirPainel({
      processos: [processo({ id: 'p1', created_at: dia(12), updated_at: dia(10) })],
      etapas: [etapa({ created_at: dia(10), decidida_em: null, decisao: 'pendente' })],
      agora: AGORA,
    });
    expect(p.aguardandoDecisao).toBe(1);
    expect(p.parados[0]!.aguardandoDecisao).toBe(true);
  });

  it('processo concluído nunca aparece como parado', () => {
    const p = construirPainel({
      processos: [processo({ status: 'concluido', created_at: dia(70), updated_at: dia(60) })],
      etapas: [],
      agora: AGORA,
    });
    expect(p.parados).toEqual([]);
  });
});

describe('SLA e retrabalho por etapa', () => {
  it('mede as horas entre a IA entregar e o comprador decidir', () => {
    const base = new Date('2026-09-20T08:00:00Z');
    const p = construirPainel({
      processos: [processo()],
      etapas: [
        etapa({
          id: 'e1',
          created_at: base.toISOString(),
          decidida_em: new Date(base.getTime() + 4 * 3600_000).toISOString(),
        }),
        etapa({
          id: 'e2',
          created_at: base.toISOString(),
          decidida_em: new Date(base.getTime() + 2 * 3600_000).toISOString(),
        }),
      ],
      agora: AGORA,
    });
    expect(p.etapas.find((e) => e.etapa === 'solicitacao')!.horasAteDecisao).toBe(3);
  });

  it('calcula o retrabalho sobre as decididas, ignorando pendentes', () => {
    const p = construirPainel({
      processos: [processo()],
      etapas: [
        etapa({ id: '1', etapa: 'rfq', decisao: 'ajustar' }),
        etapa({ id: '2', etapa: 'rfq', decisao: 'siga' }),
        etapa({ id: '3', etapa: 'rfq', decisao: 'pendente', decidida_em: null }),
      ],
      agora: AGORA,
    });
    const rfq = p.etapas.find((e) => e.etapa === 'rfq')!;
    expect(rfq.ajustes).toBe(1);
    expect(rfq.aprovacoes).toBe(1);
    expect(rfq.retrabalhoPct).toBe(50);
  });

  it('etapa sem execução não vira 0% enganoso nem tempo inventado', () => {
    const p = construirPainel({ processos: [processo()], etapas: [], agora: AGORA });
    const po = p.etapas.find((e) => e.etapa === 'po')!;
    expect(po.retrabalhoPct).toBe(0);
    expect(po.horasAteDecisao).toBeNull();
  });
});

// Metas de SLA definidas pelo próprio cliente (24/09/2026). Sem meta o painel
// mede, mas não julga — "SLA" sem alvo é só medição.
describe('metas de SLA', () => {
  const base = new Date('2026-09-20T08:00:00Z');
  const decidida = (horas: number) =>
    etapa({
      id: `e${horas}`,
      etapa: 'aprovacao',
      created_at: base.toISOString(),
      decidida_em: new Date(base.getTime() + horas * 3600_000).toISOString(),
    });

  it('sem meta, não inventa percentual de cumprimento', () => {
    const p = construirPainel({
      processos: [processo()],
      etapas: [decidida(50)],
      agora: AGORA,
    });
    const ap = p.etapas.find((e) => e.etapa === 'aprovacao')!;
    expect(ap.metaHoras).toBeNull();
    expect(ap.dentroDaMetaPct).toBeNull();
    expect(ap.estouros).toBe(0);
  });

  it('com meta, calcula cumprimento e conta os estouros', () => {
    const p = construirPainel({
      processos: [processo()],
      // 2h e 4h dentro da meta de 24h; 40h estoura.
      etapas: [decidida(2), decidida(4), decidida(40)],
      agora: AGORA,
      slas: { aprovacao: 24 },
    });
    const ap = p.etapas.find((e) => e.etapa === 'aprovacao')!;
    expect(ap.metaHoras).toBe(24);
    expect(ap.estouros).toBe(1);
    expect(ap.dentroDaMetaPct).toBe(67); // 2 de 3
  });

  it('meta 0 é tratada como "sem meta"', () => {
    const p = construirPainel({
      processos: [processo()],
      etapas: [decidida(50)],
      agora: AGORA,
      slas: { aprovacao: 0 },
    });
    expect(p.etapas.find((e) => e.etapa === 'aprovacao')!.metaHoras).toBeNull();
  });

  it('acusa compra que estourou a meta ANTES de virar "parada há 3 dias"', () => {
    const p = construirPainel({
      // parada há ~1 dia: não entra na lista de paradas…
      processos: [
        processo({ id: 'p1', etapa_atual: 'aprovacao', created_at: dia(2), updated_at: dia(1) }),
      ],
      etapas: [],
      agora: AGORA,
      slas: { aprovacao: 4 }, // …mas a meta é de 4 horas
    });

    expect(p.parados).toEqual([]);
    expect(p.foraDoPrazo.map((x) => x.id)).toEqual(['p1']);
  });

  it('sem meta na etapa, nada entra em fora do prazo', () => {
    const p = construirPainel({
      processos: [processo({ id: 'p1', created_at: dia(40), updated_at: dia(30) })],
      etapas: [],
      agora: AGORA,
    });
    expect(p.foraDoPrazo).toEqual([]);
    expect(p.parados).toHaveLength(1); // continua aparecendo como parada
  });
});
