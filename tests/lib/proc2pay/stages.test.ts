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

  it('14/15 são opcionais e fora do MVP', () => {
    expect(getStage('follow_up').optional).toBe(true);
    expect(getStage('avaliacao').optional).toBe(true);
    expect(getStage('follow_up').mvp).toBe(false);
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
  it('após a requisição → estratégia', () => {
    expect(nextStage({ requisicao: reqPayload })!.id).toBe('estrategia');
  });
  it('trilho completo → null', () => {
    expect(nextStage(contextUpTo('emissao_po'))).toBeNull();
  });
});

describe('canRunStage (gating sequencial)', () => {
  it('requisição pode rodar do zero', () => {
    expect(canRunStage('requisicao', {})).toBe(true);
  });
  it('estratégia NÃO roda sem requisição', () => {
    expect(canRunStage('estrategia', {})).toBe(false);
  });
  it('estratégia roda com requisição feita', () => {
    expect(canRunStage('estrategia', { requisicao: reqPayload })).toBe(true);
  });
  it('emissão da PO só roda com tudo anterior completo', () => {
    expect(canRunStage('emissao_po', contextUpTo('aprovacao'))).toBe(true);
    expect(canRunStage('emissao_po', contextUpTo('negociacao'))).toBe(false);
  });
  it('etapa opcional (avaliação) roda assim que há requisição', () => {
    expect(canRunStage('avaliacao', {})).toBe(false);
    expect(canRunStage('avaliacao', { requisicao: reqPayload })).toBe(true);
  });
});

describe('isTrackComplete', () => {
  it('false no meio, true no fim', () => {
    expect(isTrackComplete(contextUpTo('negociacao'))).toBe(false);
    expect(isTrackComplete(contextUpTo('emissao_po'))).toBe(true);
  });
});
