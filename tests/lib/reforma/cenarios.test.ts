import { describe, expect, it } from 'vitest';

import {
  CANDIDATAS_SUGESTAO,
  CENARIOS_REFORMA,
  aliquotasDoAno,
  conferirDestaque,
  dataDoFatoGerador,
  interpretarResposta,
  itensParaMotor,
  totalizar,
  type ItemCalculo,
} from '@/lib/reforma/cenarios';
import type { RespostaCalculo } from '@/lib/reforma/calculadora';

const ref = { cbs: 8.8, ibs: 17.7 };

describe('alíquotas da transição', () => {
  it('2026 não informa alíquota (o motor usa as oficiais e proíbe informar)', () => {
    expect(aliquotasDoAno(2026, ref)).toBeNull();
  });

  it('2027 e 2028: CBS cheia menos 0,1 ponto e IBS de 0,1% dividido', () => {
    expect(aliquotasDoAno(2027, ref)).toEqual({ cbs: 8.7, ibsEstadual: 0.05, ibsMunicipal: 0.05 });
    expect(aliquotasDoAno(2028, ref)).toEqual({ cbs: 8.7, ibsEstadual: 0.05, ibsMunicipal: 0.05 });
  });

  it('2029 a 2032: IBS em parcelas de 10%; 2033 cheio', () => {
    const a29 = aliquotasDoAno(2029, ref)!;
    expect(a29.cbs).toBe(8.8);
    expect(a29.ibsEstadual + a29.ibsMunicipal).toBeCloseTo(1.77, 4);
    const a32 = aliquotasDoAno(2032, ref)!;
    expect(a32.ibsEstadual + a32.ibsMunicipal).toBeCloseTo(7.08, 4);
    const a33 = aliquotasDoAno(2033, ref)!;
    expect(a33.ibsEstadual + a33.ibsMunicipal).toBeCloseTo(17.7, 4);
  });

  it('respeita a referência editada na tela', () => {
    expect(aliquotasDoAno(2033, { cbs: 9, ibs: 18 })).toEqual({ cbs: 9, ibsEstadual: 9, ibsMunicipal: 9 });
  });

  it('cenários cobrem hoje, transição e reforma completa', () => {
    expect(CENARIOS_REFORMA.map((c) => c.ano)).toEqual([2026, 2027, 2029, 2031, 2033]);
    expect(CENARIOS_REFORMA.filter((c) => c.oficial).map((c) => c.ano)).toEqual([2026]);
  });

  it('data do fato gerador: hoje no ano corrente, meio do ano nos demais', () => {
    const agora = new Date('2026-11-12T15:00:00Z');
    expect(dataDoFatoGerador(2026, agora)).toBe('2026-11-12T10:00:00-03:00');
    expect(dataDoFatoGerador(2029, agora)).toBe('2029-06-01T10:00:00-03:00');
  });
});

const itens: ItemCalculo[] = [
  { descricao: 'Cimento', ncm: '2523.29.10', cst: '000', cClassTrib: '000001', valor: 1000, unidade: 'SACO_50KG' },
  { descricao: 'Sabão', ncm: '34011190', cst: '200', cClassTrib: '200035', valor: 500, destacado: { cbs: 1.8, ibs: 0.2 } },
];

describe('montagem do pedido ao motor', () => {
  it('limpa o NCM, corta a unidade e só manda alíquotas a partir de 2027', () => {
    const m26 = itensParaMotor(itens, 2026, ref);
    expect(m26[0]).toMatchObject({ numero: 1, ncm: '25232910', baseCalculo: 1000, unidade: 'SACO_5' });
    expect(m26[0]!.aliquotasNominais).toBeUndefined();
    expect(itensParaMotor(itens, 2033, ref)[1]!.aliquotasNominais).toEqual({ cbs: 8.8, ibsEstadual: 8.85, ibsMunicipal: 8.85 });
  });

  it('não manda NCM incompleto', () => {
    expect(itensParaMotor([{ ...itens[0]!, ncm: '2523' }], 2027, ref)[0]!.ncm).toBeUndefined();
  });
});

function resposta(valores: Array<{ cbs: string; ibsUf: string; ibsMun: string; red?: string; pCbs?: string }>): RespostaCalculo {
  return {
    objetos: valores.map((v, i) => ({
      nObj: i + 1,
      tribCalc: {
        IBSCBS: {
          CST: '000',
          cClassTrib: '000001',
          gIBSCBS: {
            vBC: '0',
            gIBSUF: { pIBSUF: '8.85', vIBSUF: v.ibsUf },
            gIBSMun: { pIBSMun: '8.85', vIBSMun: v.ibsMun },
            vIBS: (Number(v.ibsUf) + Number(v.ibsMun)).toFixed(2),
            gCBS: { pCBS: v.pCbs ?? '8.80', vCBS: v.cbs, memoriaCalculo: 'Base legal X', ...(v.red ? { gRed: { pRedAliq: v.red } } : {}) },
          },
        },
      },
    })),
  };
}

const classif = new Map([
  ['000001', { creditoCbs: true, creditoIbs: true }],
  ['200035', { creditoCbs: true, creditoIbs: false }],
]);

describe('leitura do resultado', () => {
  const r = resposta([
    { cbs: '88.00', ibsUf: '88.50', ibsMun: '88.50' },
    { cbs: '17.60', ibsUf: '17.70', ibsMun: '17.70', red: '60.00' },
  ]);

  it('regime regular: crédito segue o que a classificação permite e o custo real desconta o crédito', () => {
    const res = interpretarResposta({ resposta: r, itens, ano: 2033, regime: 'regular', classificacoes: classif });
    expect(res[0]).toMatchObject({ cbs: 88, ibs: 177, total: 265, credito: 265, custoReal: 1000, aliquotaEfetiva: 26.5, aliqIbs: 17.7 });
    // 200035 aqui só credita a CBS (dado de teste): IBS vira custo.
    expect(res[1]).toMatchObject({ total: 53, credito: 17.6, custoReal: 535.4, reducao: 60, memoria: 'Base legal X' });
  });

  it('comprador do Simples não credita: o imposto inteiro vira custo', () => {
    const res = interpretarResposta({ resposta: r, itens, ano: 2033, regime: 'simples', classificacoes: classif });
    expect(res[0]).toMatchObject({ credito: 0, custoReal: 1265 });
  });

  it('2026 é teste: imposto aparece, mas não vira custo', () => {
    const res = interpretarResposta({ resposta: r, itens, ano: 2026, regime: 'simples', classificacoes: classif });
    expect(res[0]!.total).toBe(265);
    expect(res[0]!.custoReal).toBe(1000);
  });

  it('totaliza por ano', () => {
    const res = interpretarResposta({ resposta: r, itens, ano: 2033, regime: 'regular', classificacoes: classif });
    expect(totalizar(itens, res)).toEqual({ valor: 1500, cbs: 105.6, ibs: 212.4, total: 318, credito: 282.6, custoReal: 1535.4 });
  });
});

describe('conferência do destaque da nota', () => {
  const r = interpretarResposta({
    resposta: resposta([{ cbs: '9.00', ibsUf: '1.00', ibsMun: '0.00' }, { cbs: '1.80', ibsUf: '0.20', ibsMun: '0.00' }]),
    itens,
    ano: 2026,
    regime: 'regular',
    classificacoes: classif,
  });

  it('confere quando bate e avisa quando a nota não destaca', () => {
    expect(conferirDestaque(itens[1]!, r[1]).situacao).toBe('confere');
    expect(conferirDestaque(itens[0]!, r[0]).situacao).toBe('sem_destaque');
  });

  it('aponta a divergência com os dois valores', () => {
    const c = conferirDestaque({ ...itens[1]!, destacado: { cbs: 4.5, ibs: 0.2 } }, r[1]);
    expect(c.situacao).toBe('diverge');
    expect(c.mensagem).toMatch(/CBS na nota R\$\s?4,50, oficial R\$\s?1,80/);
  });
});

describe('sugestão de classificação', () => {
  it('não sugere classificações que o motor aceita para qualquer NCM', () => {
    for (const c of ['200009', '200013', '200032', '200036']) {
      expect(CANDIDATAS_SUGESTAO as readonly string[]).not.toContain(c);
    }
    expect(CANDIDATAS_SUGESTAO).toContain('200003');
  });
});
