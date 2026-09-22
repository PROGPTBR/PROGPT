import { describe, expect, it } from 'vitest';

import {
  FLUXO_STAGES,
  FLUXO_STAGE_IDS,
  TOTAL_ETAPAS,
  getStage,
  getStageByNum,
  isFluxoStageId,
  proximaEtapa,
} from '@/lib/fluxo/stages';

// Estes testes travam a PLANILHA (Fluxo_Automatizado_Compras_PROGPT.xlsx,
// aba "Operação"). Se alguém reordenar, renomear ou remover etapa sem que a
// planilha tenha mudado, quebra aqui — de propósito.

describe('as 8 etapas da planilha', () => {
  it('tem exatamente 8 etapas, numeradas de 1 a 8 em ordem', () => {
    expect(TOTAL_ETAPAS).toBe(8);
    expect(FLUXO_STAGES.map((s) => s.num)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('mantém os ids e a ordem da planilha', () => {
    expect(FLUXO_STAGES.map((s) => s.id)).toEqual([
      'solicitacao',
      'aprovacao',
      'fornecedores',
      'rfq',
      'analise',
      'po',
      'acompanhamento',
      'recebimento',
    ]);
    expect(FLUXO_STAGE_IDS.length).toBe(8);
  });

  it('separa S2C (1–4) de P2P (5–8) como na planilha', () => {
    const s2c = FLUXO_STAGES.filter((s) => s.trilha === 's2c').map((s) => s.num);
    const p2p = FLUXO_STAGES.filter((s) => s.trilha === 'p2p').map((s) => s.num);
    expect(s2c).toEqual([1, 2, 3, 4]);
    expect(p2p).toEqual([5, 6, 7, 8]);
  });

  it('a saída de cada etapa é a entrada da seguinte (encadeamento do fluxo)', () => {
    // A planilha declara entrada/saída por etapa; o encadeamento é o produto.
    expect(getStage('solicitacao')!.saida).toBe('Solicitação validada');
    expect(getStage('aprovacao')!.entrada).toBe('Solicitação validada');

    expect(getStage('aprovacao')!.saida).toBe('Solicitação aprovada');
    expect(getStage('fornecedores')!.entrada).toBe('Solicitação aprovada');

    expect(getStage('fornecedores')!.saida).toBe('Fornecedores selecionados');
    expect(getStage('rfq')!.entrada).toBe('Fornecedores selecionados');
  });

  it('toda etapa declara as duas decisões possíveis', () => {
    for (const s of FLUXO_STAGES) {
      expect(s.seSiga.length).toBeGreaterThan(3);
      expect(s.seAjustar.length).toBeGreaterThan(3);
    }
  });

  it('toda etapa pede uma entrada do comprador (senão a IA inventaria dado)', () => {
    for (const s of FLUXO_STAGES) {
      expect(s.entrada_do_usuario.rotulo.length).toBeGreaterThan(3);
      expect(s.entrada_do_usuario.placeholder.length).toBeGreaterThan(10);
    }
  });
});

describe('navegação entre etapas', () => {
  it('avança na ordem', () => {
    expect(proximaEtapa('solicitacao')!.id).toBe('aprovacao');
    expect(proximaEtapa('analise')!.id).toBe('po');
  });

  it('a última etapa não tem próxima — é o fim do processo', () => {
    expect(proximaEtapa('recebimento')).toBeNull();
  });

  it('resolve etapa por id e por número', () => {
    expect(getStageByNum(5)!.id).toBe('analise');
    expect(getStage('nao_existe')).toBeNull();
    expect(getStageByNum(99)).toBeNull();
  });

  it('valida id vindo do banco (a coluna é text livre, sem CHECK)', () => {
    expect(isFluxoStageId('rfq')).toBe(true);
    expect(isFluxoStageId('etapa_inventada')).toBe(false);
    expect(isFluxoStageId(null)).toBe(false);
  });
});
