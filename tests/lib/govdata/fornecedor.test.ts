import { describe, it, expect } from 'vitest';
import { aggregateResultados } from '@/lib/govdata/fornecedor';

// Agregação do histórico público de um fornecedor (itens homologados em compras
// públicas federais). Pura/testável; o fetch + janela de datas fica fora.

const row = (o: Partial<Record<string, unknown>> = {}) => ({
  valorTotalHomologado: 1000,
  unidadeOrgaoUfSigla: 'SP',
  orgaoEntidadeCnpj: '111',
  nomeRazaoSocialFornecedor: 'ACME LTDA',
  ...o,
});

describe('aggregateResultados', () => {
  it('total vem do totalRegistros (não do tamanho da página)', () => {
    const r = aggregateResultados([row(), row()], 1294, 12);
    expect(r.consultado).toBe(true);
    expect(r.totalItens).toBe(1294);
    expect(r.amostra).toBe(2);
    expect(r.periodoMeses).toBe(12);
  });

  it('soma só valores homologados positivos (ignora 0 e inválidos)', () => {
    const r = aggregateResultados(
      [row({ valorTotalHomologado: 1000 }), row({ valorTotalHomologado: 0 }), row({ valorTotalHomologado: 500 })],
      3,
      12,
    );
    expect(r.valorAmostra).toBe(1500);
  });

  it('coleta UFs e contagem de órgãos distintos', () => {
    const r = aggregateResultados(
      [
        row({ unidadeOrgaoUfSigla: 'SP', orgaoEntidadeCnpj: '111' }),
        row({ unidadeOrgaoUfSigla: 'RJ', orgaoEntidadeCnpj: '222' }),
        row({ unidadeOrgaoUfSigla: 'SP', orgaoEntidadeCnpj: '111' }),
      ],
      3,
      12,
    );
    expect(r.ufs.sort()).toEqual(['RJ', 'SP']);
    expect(r.nOrgaos).toBe(2);
    expect(r.razaoSocial).toBe('ACME LTDA');
  });

  it('zero itens → consultado true mas fornece=false', () => {
    const r = aggregateResultados([], 0, 12);
    expect(r.consultado).toBe(true);
    expect(r.totalItens).toBe(0);
    expect(r.forneceAoGoverno).toBe(false);
  });

  it('com itens → forneceAoGoverno true', () => {
    expect(aggregateResultados([row()], 5, 12).forneceAoGoverno).toBe(true);
  });
});
