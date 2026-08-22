import { describe, it, expect } from 'vitest';
import {
  buildPesquisaPrecosPrompt,
  itensSemAmostra,
  PESQUISA_PRECOS_SYSTEM_PROMPT,
  type PesquisaPrecosClassified,
} from '@/lib/assistants/pesquisa-precos';
import type { TemplateRow } from '@/lib/assistants/types';

const template: TemplateRow = {
  id: 't1',
  assistant_type: 'pesquisa_precos',
  name: 'Mapa de Preços (padrão)',
  description: null,
  body_md: '# Mapa de Preços\n\n## 1. Resumo',
  created_by: null,
  created_at: '2026-06-23',
  updated_at: '2026-06-23',
};

const classified: PesquisaPrecosClassified = {
  titulo: 'Cesta teste',
  uf: 'SP',
  anyAvailable: true,
  itens: [
    {
      descricao: 'Açúcar refinado 1kg',
      unidade: 'kg',
      quantidade: 100,
      match: {
        codigoItem: 463998,
        descricaoItem: 'AÇÚCAR, TIPO: REFINADO',
        codigoClasse: 8925,
        nomeClasse: 'AÇÚCAR E SIMILARES',
        codigoPdm: 19777,
        nomePdm: 'AÇÚCAR',
        confianca: 0.9,
        rationale: 'match direto',
      },
      preco: {
        codigoItem: 463998,
        totalAmostras: 500,
        amostras: [
          {
            precoUnitario: 4.48,
            quantidade: 1,
            dataCompra: '2026-06-03',
            unidade: 'kg',
            fornecedor: 'ACME ALIMENTOS',
            marca: 'X',
            uf: 'SP',
            municipio: 'São Paulo',
            orgao: 'Órgão Y',
          },
        ],
        stats: { mediana: 4.48, p25: 3.99, p75: 5.95, min: 3.6, max: 8.1, n: 465, nBruto: 500, outliersRemovidos: 35 },
      },
    },
    {
      descricao: 'Item mapeado sem preço',
      unidade: 'un',
      match: {
        codigoItem: 1,
        descricaoItem: 'ITEM RARO',
        codigoClasse: 1,
        nomeClasse: 'CLASSE',
        codigoPdm: 1,
        nomePdm: 'PDM',
        confianca: 0.5,
        rationale: 'r',
      },
      preco: { codigoItem: 1, stats: null, amostras: [], totalAmostras: 0 },
    },
    {
      descricao: 'Item impossível de mapear xyzzy',
      unidade: '',
      match: null,
      preco: null,
    },
  ],
};

describe('buildPesquisaPrecosPrompt', () => {
  const params = { titulo: 'Cesta teste', uf: 'SP', itens: [], notas: '' };
  const { system, user } = buildPesquisaPrecosPrompt(params, classified, template, []);

  it('usa o SYSTEM_PROMPT da pesquisa de preços', () => {
    expect(system).toBe(PESQUISA_PRECOS_SYSTEM_PROMPT);
  });

  it('injeta a mediana e a faixa do item com preço', () => {
    expect(user).toContain('R$ 4,48');
    expect(user).toContain('3,99');
    expect(user).toContain('5,95');
    expect(user).toContain('465 compras');
  });

  it('mostra o custo estimado quando há quantidade', () => {
    // mediana 4,48 × 100 = 448,00
    expect(user).toContain('R$ 448,00');
  });

  it('sinaliza item mapeado porém sem preço', () => {
    expect(user).toContain('sem preços praticados');
  });

  it('sinaliza item que não mapeou no catálogo', () => {
    expect(user).toMatch(/Não foi possível mapear/i);
  });

  it('declara a fonte (compras públicas) e o recorte de UF', () => {
    expect(user).toMatch(/compras públicas/i);
    expect(user).toContain('UF SP');
  });
});

// Backlog do diretor, 2026-08-19 (Batch G) — "Buscar preço e NCM aproximado".
describe('itensSemAmostra', () => {
  it('omite o item com preço e lista os 2 sem preço (mapeado sem amostra + não-mapeado)', () => {
    const r = itensSemAmostra(classified);
    expect(r).toHaveLength(2);
    expect(r.map((i) => i.descricao)).toEqual([
      'Item mapeado sem preço',
      'Item impossível de mapear xyzzy',
    ]);
  });

  it('preserva a unidade quando informada e omite quando vazia', () => {
    const r = itensSemAmostra(classified);
    expect(r[0]!.unidade).toBe('un');
    expect(r[1]!.unidade).toBeUndefined();
  });

  it('lista vazia quando todos os itens têm preço', () => {
    const allPriced: PesquisaPrecosClassified = {
      ...classified,
      itens: [classified.itens[0]!],
    };
    expect(itensSemAmostra(allPriced)).toEqual([]);
  });
});
