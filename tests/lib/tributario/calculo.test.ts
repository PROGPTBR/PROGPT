import { describe, expect, it } from 'vitest';
import {
  analisarPropostas,
  tabelaCustoLiquido,
  type ParametrosTributarios,
  type PropostaTributaria,
} from '@/lib/tributario/calculo';

const normal: PropostaTributaria = {
  fornecedor: 'Normal SA',
  cnpj: '',
  uf: 'SP',
  regimeFornecedor: 'regular',
  valorProdutos: 100_000,
  ipiPct: 5,
  icmsPct: 12,
  pisCofinsPct: 9.25,
  stValor: 0,
  freteValor: 1_800,
  reducaoReformaPct: 0,
};

const simples: PropostaTributaria = {
  ...normal,
  fornecedor: 'Simples ME',
  regimeFornecedor: 'simples',
  valorProdutos: 85_000,
  ipiPct: 0,
  icmsPct: 2.5,
  pisCofinsPct: 0,
  freteValor: 1_000,
};

function ctx(over: Partial<ParametrosTributarios> = {}): ParametrosTributarios {
  return {
    descricaoCompra: 'Chapas de aço',
    regimeComprador: 'lucro_real',
    destinacao: 'insumo',
    ufComprador: 'SP',
    cbsPct: 8.8,
    ibsPct: 17.7,
    simplesCreditoPct: 4,
    propostas: [normal, simples],
    notes: '',
    ...over,
  };
}

describe('analisarPropostas', () => {
  it('hoje: credita ICMS, IPI (insumo) e PIS/Cofins sem ICMS na base (Lucro Real)', () => {
    const r = analisarPropostas(ctx()).propostas[0]!.cenarios.atual;
    expect(r.desembolso).toBe(106_800); // 100.000 + IPI 5.000 + frete 1.800
    expect(r.detalhe.creditoIcms).toBe(12_000);
    expect(r.detalhe.creditoIpi).toBe(5_000);
    expect(r.detalhe.creditoPisCofins).toBe(8_140); // (100.000 - 12.000) x 9,25%
    expect(r.custoLiquido).toBe(81_660);
  });

  it('reforma: fornecedor normal reprecifica sem ICMS/PIS/Cofins e IBS/CBS voltam inteiros como crédito', () => {
    const p = analisarPropostas(ctx()).propostas[0]!;
    // base limpa = 100.000 - 12.000 - 9.250 = 78.750; + frete
    expect(p.cenarios['2027'].custoLiquido).toBe(80_550);
    expect(p.cenarios['2029'].detalhe.icms).toBe(10_800); // ICMS 10% menor
    expect(p.cenarios['2029'].custoLiquido).toBe(80_550);
    expect(p.cenarios['2033'].detalhe.cbs).toBe(6_930);
    expect(p.cenarios['2033'].detalhe.ibs).toBe(13_938.75);
    expect(p.cenarios['2033'].custoLiquido).toBe(80_550);
    expect(p.cenarios['2033'].detalhe.ipi).toBe(0);
  });

  it('fornecedor do Simples: barato hoje, perde na reforma porque transfere pouco crédito', () => {
    const a = analisarPropostas(ctx());
    const s = a.propostas[1]!;
    expect(s.cenarios.atual.custoLiquido).toBe(76_209.06);
    // 2027: só a parte CBS do crédito do DAS (4% x 8,8/26,5)
    expect(s.cenarios['2027'].detalhe.creditoIbsCbs).toBe(1_129.06);
    expect(s.cenarios['2033'].custoLiquido).toBe(82_600); // 86.000 - 3.400
    expect(a.melhorPorCenario.atual).toBe(1);
    expect(a.melhorPorCenario['2033']).toBe(0);
    expect(a.viradaNaReforma).toBe(true);
  });

  it('comprador do Simples Nacional não credita nada: custo líquido = desembolso', () => {
    const a = analisarPropostas(ctx({ regimeComprador: 'simples' }));
    for (const p of a.propostas) {
      for (const c of Object.values(p.cenarios)) expect(c.custoLiquido).toBe(c.desembolso);
    }
    expect(a.avisos.join(' ')).toMatch(/Simples Nacional não aproveita/);
  });

  it('uso e consumo: sem crédito de ICMS e PIS/Cofins hoje, com crédito de IBS/CBS na reforma', () => {
    const p = analisarPropostas(ctx({ destinacao: 'uso_consumo' })).propostas[0]!;
    expect(p.cenarios.atual.creditos).toBe(0);
    expect(p.cenarios['2033'].detalhe.creditoIbsCbs).toBeGreaterThan(0);
  });

  it('Lucro Presumido não credita PIS/Cofins hoje, mas credita IBS/CBS na reforma', () => {
    const p = analisarPropostas(ctx({ regimeComprador: 'lucro_presumido' })).propostas[0]!;
    expect(p.cenarios.atual.detalhe.creditoPisCofins).toBe(0);
    expect(p.cenarios['2033'].detalhe.creditoIbsCbs).toBe(20_868.75);
  });

  it('redução de alíquota da reforma reduz IBS/CBS do item', () => {
    const p = analisarPropostas(ctx({ propostas: [{ ...normal, reducaoReformaPct: 60 }, simples] })).propostas[0]!;
    expect(p.cenarios['2033'].detalhe.cbs).toBe(2_772); // 6.930 x 40%
  });

  it('empate fica com a primeira proposta', () => {
    const a = analisarPropostas(ctx({ propostas: [normal, { ...normal, fornecedor: 'Gêmeo' }] }));
    expect(a.melhorPorCenario.atual).toBe(0);
  });

  it('tabela em markdown traz o vencedor de cada ano em negrito', () => {
    const c = ctx();
    const md = tabelaCustoLiquido(c, analisarPropostas(c));
    expect(md.split('\n')).toHaveLength(4);
    expect(md).toContain('**R$');
    expect(md).toContain('Simples ME (Simples Nacional)');
  });
});
