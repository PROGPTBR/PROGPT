import { describe, it, expect } from 'vitest';
import {
  STAGES,
  MVP_TRACK,
  getStage,
  stageIndex,
  isStageComplete,
  nextStage,
  canRunStage,
  isTrackComplete,
} from '@/lib/proc2pay/stages';
import type { Proc2PayContext, RequisicaoPayload } from '@/lib/proc2pay/types';

const reqPayload: RequisicaoPayload = {
  solicitante: 'Produção',
  descricao: 'Válvulas',
  itens: [{ descricao: 'Válvula esfera 2"', qtd: 10, unidade: 'un' }],
};

// Constrói um context com o trilho preenchido até (e incluindo) `upTo`.
function contextUpTo(upTo: string): Proc2PayContext {
  const ctx: Record<string, unknown> = {};
  for (const s of MVP_TRACK) {
    ctx[s.produces!] = stubFor(s.produces!);
    if (s.id === upTo) break;
  }
  return ctx as Proc2PayContext;
}

function stubFor(key: keyof Proc2PayContext): unknown {
  if (key === 'requisicao') return reqPayload;
  if (key === 'fornecedores') return [{ nome: 'ACME' }];
  // A aprovação não conta como vencida só por existir: desde 24/09/2026 uma
  // compra REPROVADA não destrava a emissão da PO. Um contexto "completo"
  // precisa, portanto, de uma aprovação de fato aprovada.
  if (key === 'aprovacao') return { decision: 'aprovado' };
  return { ok: true };
}

describe('STAGES config', () => {
  it('tem 13 etapas (3..15) em ordem crescente de num', () => {
    expect(STAGES).toHaveLength(13);
    const nums = STAGES.map((s) => s.num);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    expect(nums[0]).toBe(3);
    expect(nums[nums.length - 1]).toBe(15);
  });

  it('o trilho MVP é só obrigatório+mvp, em ordem, começando na requisição e terminando na PO', () => {
    expect(MVP_TRACK[0]!.id).toBe('requisicao');
    expect(MVP_TRACK[MVP_TRACK.length - 1]!.id).toBe('emissao_po');
    expect(MVP_TRACK.every((s) => s.mvp && !s.optional)).toBe(true);
  });

  it('14/15 são opcionais (não bloqueiam o trilho) mas aparecem no cockpit (mvp)', () => {
    expect(getStage('follow_up').optional).toBe(true);
    expect(getStage('avaliacao').optional).toBe(true);
    expect(getStage('follow_up').mvp).toBe(true);
    // não entram no trilho obrigatório
    expect(MVP_TRACK.some((s) => s.id === 'follow_up')).toBe(false);
  });

  it('getStage lança em etapa desconhecida', () => {
    expect(() => getStage('xpto' as never)).toThrow(/desconhecida/);
  });

  it('stageIndex reflete a ordem', () => {
    expect(stageIndex('requisicao')).toBe(0);
    expect(stageIndex('emissao_po')).toBeGreaterThan(stageIndex('negociacao'));
  });
});

describe('isStageComplete', () => {
  it('false quando a chave produzida não está no context', () => {
    expect(isStageComplete('estrategia', {})).toBe(false);
  });
  it('true quando a chave produzida existe', () => {
    expect(isStageComplete('requisicao', { requisicao: reqPayload })).toBe(true);
  });
});

describe('nextStage', () => {
  it('context vazio → próxima é a requisição', () => {
    expect(nextStage({})!.id).toBe('requisicao');
  });
  it('após a requisição → análise crítica', () => {
    expect(nextStage({ requisicao: reqPayload })!.id).toBe('analise_critica');
  });
  it('trilho completo → null', () => {
    expect(nextStage(contextUpTo('emissao_po'))).toBeNull();
  });
});

describe('canRunStage (gating sequencial)', () => {
  it('requisição pode rodar do zero', () => {
    expect(canRunStage('requisicao', {})).toBe(true);
  });
  it('análise crítica NÃO roda sem requisição', () => {
    expect(canRunStage('analise_critica', {})).toBe(false);
  });
  it('análise crítica roda com requisição feita', () => {
    expect(canRunStage('analise_critica', { requisicao: reqPayload })).toBe(true);
  });
  it('estratégia NÃO roda só com requisição (precisa de análise + escopo antes)', () => {
    expect(canRunStage('estrategia', { requisicao: reqPayload })).toBe(false);
    expect(
      canRunStage('estrategia', {
        requisicao: reqPayload,
        analise_critica: { ok: true, gaps: [] },
        escopo: { resumo: 'x' },
      }),
    ).toBe(true);
  });
  it('emissão da PO só roda com tudo anterior completo', () => {
    expect(canRunStage('emissao_po', contextUpTo('aprovacao'))).toBe(true);
    expect(canRunStage('emissao_po', contextUpTo('negociacao'))).toBe(false);
  });
  it('cauda opcional (avaliação) só roda depois do trilho completo (PO emitida)', () => {
    expect(canRunStage('avaliacao', { requisicao: reqPayload })).toBe(false);
    expect(canRunStage('avaliacao', contextUpTo('emissao_po'))).toBe(true);
  });
});

describe('isTrackComplete', () => {
  it('false no meio, true no fim', () => {
    expect(isTrackComplete(contextUpTo('negociacao'))).toBe(false);
    expect(isTrackComplete(contextUpTo('emissao_po'))).toBe(true);
  });
});

// Bug encontrado em 24/09/2026 (estava documentado como conhecido desde
// julho): reprovar uma compra NÃO impedia a emissão do pedido. O gate de
// aprovação é a promessa central do produto — "a decisão é de uma pessoa" —,
// então valia corrigir mesmo com o módulo a caminho da aposentadoria.
describe('gate de aprovação — reprovar bloqueia a PO', () => {
  it('aprovação APROVADA conclui a etapa', () => {
    expect(isStageComplete('aprovacao', { aprovacao: { decision: 'aprovado' } })).toBe(true);
  });

  it('aprovação REPROVADA não conclui a etapa', () => {
    expect(isStageComplete('aprovacao', { aprovacao: { decision: 'reprovado' } })).toBe(false);
  });

  it('com a compra reprovada, a emissão da PO continua bloqueada', () => {
    const contexto = {
      ...contextUpTo('negociacao'),
      aprovacao: { decision: 'reprovado' as const },
    } as Proc2PayContext;

    expect(canRunStage('emissao_po', contexto)).toBe(false);
  });

  it('a mesma compra, aprovada, libera a emissão da PO', () => {
    const contexto = {
      ...contextUpTo('negociacao'),
      aprovacao: { decision: 'aprovado' as const },
    } as Proc2PayContext;

    expect(canRunStage('emissao_po', contexto)).toBe(true);
  });

  it('reprovado mantém a aprovação como próxima etapa (pede nova decisão)', () => {
    const contexto = {
      ...contextUpTo('negociacao'),
      aprovacao: { decision: 'reprovado' as const },
    } as Proc2PayContext;

    expect(nextStage(contexto)?.id).toBe('aprovacao');
  });
});
