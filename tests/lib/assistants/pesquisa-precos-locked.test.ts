import { describe, it, expect, vi, beforeEach } from 'vitest';

// Quando o usuário escolhe o item no catálogo (autocomplete), o `codigoItem` já
// vem travado nos params — o classify deve PULAR `buscarCatmat` e puxar o preço
// direto pelo código escolhido (zero mismatch). Itens sem código caem no
// auto-resolve por LLM, como antes.

const buscarCatmat = vi.fn();
const precoReferencia = vi.fn();
vi.mock('@/lib/govdata/precos', () => ({
  buscarCatmat: (t: string) => buscarCatmat(t),
  precoReferencia: (c: number, o: unknown) => precoReferencia(c, o),
}));

import { classifyPesquisaPrecos } from '@/lib/assistants/pesquisa-precos';

beforeEach(() => {
  buscarCatmat.mockReset();
  precoReferencia.mockReset();
  precoReferencia.mockResolvedValue({ codigoItem: 0, stats: null, amostras: [], totalAmostras: 0 });
});

describe('classifyPesquisaPrecos — item travado pelo catálogo', () => {
  it('pula buscarCatmat e usa o codigoItem escolhido', async () => {
    const r = await classifyPesquisaPrecos({
      titulo: 'T',
      itens: [
        {
          descricao: 'açúcar refinado',
          unidade: 'kg',
          codigoItem: 463998,
          descricaoItemCatalogo: 'AÇÚCAR, TIPO: REFINADO',
          codigoClasse: 8925,
          nomeClasse: 'AÇÚCAR E SIMILARES',
          codigoPdm: 19777,
          nomePdm: 'AÇÚCAR',
        },
      ],
      notas: '',
    });

    expect(buscarCatmat).not.toHaveBeenCalled();
    expect(precoReferencia).toHaveBeenCalledWith(463998, expect.anything());
    const m = r.itens[0]!.match!;
    expect(m.codigoItem).toBe(463998);
    expect(m.confianca).toBe(1);
    expect(m.nomePdm).toBe('AÇÚCAR');
  });

  it('cai no auto-resolve (buscarCatmat) quando não há codigoItem', async () => {
    buscarCatmat.mockResolvedValue({
      codigoItem: 111,
      descricaoItem: 'X',
      codigoClasse: 1,
      nomeClasse: 'C',
      codigoPdm: 1,
      nomePdm: 'P',
      confianca: 0.6,
      rationale: 'r',
    });

    await classifyPesquisaPrecos({
      titulo: 'T',
      itens: [{ descricao: 'caneta azul', unidade: 'un' }],
      notas: '',
    });

    expect(buscarCatmat).toHaveBeenCalledWith('caneta azul');
    expect(precoReferencia).toHaveBeenCalledWith(111, expect.anything());
  });
});
