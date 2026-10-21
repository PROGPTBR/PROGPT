import { describe, expect, it } from 'vitest';
import { paraPropostas } from '@/lib/tributario/extrair';

const base = {
  fornecedor: 'ACME',
  cnpj: '12.345.678/0001-90',
  uf: 'sp',
  regimeFornecedor: 'regular' as const,
  valorProdutos: 1000,
  ipiPct: 5,
  icmsPct: 12,
  pisCofinsPct: null,
  stValor: null,
  freteValor: null,
  observacoes: '',
};

describe('paraPropostas', () => {
  it('preenche o que faltou com padrão explícito e marca para conferir', () => {
    const [p] = paraPropostas({
      propostas: [{ ...base, valorProdutos: null, icmsPct: null, regimeFornecedor: 'nao_informado' }],
    });
    expect(p!.valorProdutos).toBe(0);
    expect(p!.icmsPct).toBe(18);
    expect(p!.pisCofinsPct).toBe(9.25);
    expect(p!.faltando).toEqual(['valor', 'ICMS', 'regime do fornecedor']);
    expect(p!.uf).toBe('SP');
  });

  it('fornecedor do Simples não tem PIS/Cofins no preço nem ICMS padrão', () => {
    const [p] = paraPropostas({
      propostas: [{ ...base, regimeFornecedor: 'simples', icmsPct: null, pisCofinsPct: 2.5 }],
    });
    expect(p!.regimeFornecedor).toBe('simples');
    expect(p!.pisCofinsPct).toBe(0);
    expect(p!.icmsPct).toBe(0);
  });

  it('ignora valor negativo e limita a 8 propostas', () => {
    const muitas = Array.from({ length: 10 }, () => ({ ...base, freteValor: -5 }));
    const r = paraPropostas({ propostas: muitas });
    expect(r).toHaveLength(8);
    expect(r[0]!.freteValor).toBe(0);
  });

  it('Simples híbrido lido na proposta é mantido, sem PIS/Cofins embutido', () => {
    const [p] = paraPropostas({ propostas: [{ ...base, regimeFornecedor: 'simples_hibrido', pisCofinsPct: 9.25 }] });
    expect(p!.regimeFornecedor).toBe('simples_hibrido');
    expect(p!.pisCofinsPct).toBe(0);
    expect(p!.faltando).not.toContain('regime do fornecedor');
  });
});
