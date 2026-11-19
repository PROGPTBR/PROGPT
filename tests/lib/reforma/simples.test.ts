import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { aliquotasSimplesDoAno, interpretarSimples, type ItemCalculo } from '@/lib/reforma/cenarios';

const ref = { cbs: 8.8, ibs: 17.7 };

describe('alíquotas do fornecedor do Simples por ano', () => {
  it('2026 não tem CBS nem IBS no Simples', () => {
    expect(aliquotasSimplesDoAno(2026, { pCbs: 2.75, pIbs: 1.25 }, ref)).toBeNull();
  });
  it('2027 e 2028: CBS cheia e IBS na proporção do 0,1% de teste', () => {
    const a = aliquotasSimplesDoAno(2027, { pCbs: 2.75, pIbs: 1.25 }, ref)!;
    expect(a.pCBSSN).toBe(2.75);
    expect(a.pIBSSN).toBeCloseTo(1.25 * (0.1 / 17.7), 4);
  });
  it('2029 a 2032 o IBS sobe em parcelas e 2033 é cheio', () => {
    expect(aliquotasSimplesDoAno(2029, { pCbs: 2.75, pIbs: 1.25 }, ref)!.pIBSSN).toBe(0.125);
    expect(aliquotasSimplesDoAno(2031, { pCbs: 2.75, pIbs: 1.25 }, ref)!.pIBSSN).toBe(0.375);
    expect(aliquotasSimplesDoAno(2033, { pCbs: 2.75, pIbs: 1.25 }, ref)!.pIBSSN).toBe(1.25);
  });
});

describe('leitura da resposta da calculadora do Simples', () => {
  const itens: ItemCalculo[] = [
    { descricao: 'Cimento', ncm: '25232910', cst: '000', cClassTrib: '000001', valor: 1000 },
    { descricao: 'Item fora', ncm: '', cst: '000', cClassTrib: '000001', valor: 100 },
  ];
  const classificacoes = new Map([['000001', { creditoCbs: true, creditoIbs: true }]]);
  const resposta = {
    objetos: [
      { nObj: 1, estadoItem: 'CALCULADO', tribCalc: { vCBSSN: '27.50', vIBSSN: '12.50', pCBSSN: '2.75', pIBSSN: '1.25' } },
      { nObj: 2, estadoItem: 'NAO_CALCULADO', erros: [{ detail: 'atividade não admitida' }] },
    ],
  };

  it('o imposto está dentro do preço: custo = preço menos o crédito', () => {
    const [r] = interpretarSimples({ resposta, itens, ano: 2033, regime: 'regular', classificacoes });
    expect(r!.total).toBe(40);
    expect(r!.credito).toBe(40);
    expect(r!.custoReal).toBe(960);
    expect(r!.memoria).toMatch(/art\. 47/);
  });

  it('comprador do Simples não toma crédito', () => {
    const [r] = interpretarSimples({ resposta, itens, ano: 2033, regime: 'simples', classificacoes });
    expect(r!.credito).toBe(0);
    expect(r!.custoReal).toBe(1000);
  });

  it('item que o motor não calculou fica zerado com o motivo', () => {
    const r = interpretarSimples({ resposta, itens, ano: 2033, regime: 'regular', classificacoes });
    expect(r[1]!.total).toBe(0);
    expect(r[1]!.custoReal).toBe(100);
    expect(r[1]!.memoria).toMatch(/atividade não admitida/);
  });

  it('2026 devolve o preço como custo, sem imposto', () => {
    const [r] = interpretarSimples({ resposta: null, itens, ano: 2026, regime: 'regular', classificacoes });
    expect(r!.total).toBe(0);
    expect(r!.custoReal).toBe(1000);
  });
});

describe('cliente da calculadora: pública com reserva na nossa cópia', () => {
  const env = { ...process.env };
  beforeEach(async () => {
    vi.resetModules();
    process.env.CALCULADORA_RTC_URL = 'https://publica.test/api/calculadora';
    process.env.CALCULADORA_RTC_PROPRIA_URL = 'propria.test';
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  function respostas(mapa: Record<string, () => Response>) {
    const chamadas: string[] = [];
    global.fetch = vi.fn(async (url: string) => {
      chamadas.push(url);
      const host = new URL(url).host;
      return mapa[host]!();
    }) as unknown as typeof fetch;
    return chamadas;
  }

  it('usa a pública quando ela responde', async () => {
    const { versaoCalculadora } = await import('@/lib/reforma/calculadora');
    const chamadas = respostas({ 'publica.test': () => new Response('{"versaoApp":"1.7.1","versaoDb":"V0073","dataVersaoDb":"2026-11-09"}') });
    expect((await versaoCalculadora()).versaoDb).toBe('V0073');
    expect(chamadas.every((u) => u.includes('publica.test'))).toBe(true);
  });

  it('cai na nossa cópia quando a pública está fora e lembra disso', async () => {
    const { calcularRegimeGeral } = await import('@/lib/reforma/calculadora');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const chamadas = respostas({
      'publica.test': () => new Response('erro', { status: 503 }),
      'propria.test': () => new Response('{"objetos":[]}'),
    });
    const op = { dhFatoGerador: '2027-06-01T10:00:00-03:00', municipio: 4106902, uf: 'PR', itens: [] };
    await calcularRegimeGeral(op);
    expect(chamadas.some((u) => u.startsWith('https://propria.test/api/calculadora/regime-geral'))).toBe(true);
    const antes = chamadas.length;
    await calcularRegimeGeral(op);
    // Na 2ª chamada a pública é pulada (ficou marcada como fora).
    expect(chamadas.slice(antes).every((u) => u.includes('propria.test'))).toBe(true);
  });

  it('dado recusado pela pública (4xx) não vai para a reserva', async () => {
    const { calcularRegimeGeral } = await import('@/lib/reforma/calculadora');
    const chamadas = respostas({
      'publica.test': () => new Response('{"detail":"cClassTrib inválido"}', { status: 422 }),
      'propria.test': () => new Response('{"objetos":[]}'),
    });
    await expect(
      calcularRegimeGeral({ dhFatoGerador: '2027-06-01T10:00:00-03:00', municipio: 4106902, uf: 'PR', itens: [] }),
    ).rejects.toMatchObject({ status: 422, detalhe: 'cClassTrib inválido' });
    expect(chamadas.some((u) => u.includes('propria.test'))).toBe(false);
  });

  it('o Simples só fala com a nossa cópia, como empresa optante em NF-e', async () => {
    const { calcularSimples, simplesDisponivel } = await import('@/lib/reforma/simples');
    expect(simplesDisponivel()).toBe(true);
    let corpo: Record<string, unknown> = {};
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://propria.test/api/calculadora/observabilidade/simples-nacional');
      corpo = JSON.parse(String(init?.body));
      return new Response('{"objetos":[]}');
    }) as unknown as typeof fetch;
    await calcularSimples('2033-06-01', [{ numero: 1, cAtivSN: '01', cClassTrib: '000001', baseCalculo: 1000, pCBSSN: 2.75, pIBSSN: 1.25 }]);
    expect(corpo).toMatchObject({ CRT: '1', tpDoc: '55', data: '2033-06-01' });
    expect((corpo.itens as Array<Record<string, string>>)[0]).toMatchObject({ baseCalculo: '1000.00', pCBSSN: '2.7500', pIBSSN: '1.2500' });
  });

  it('sem a nossa cópia o Simples fica indisponível', async () => {
    delete process.env.CALCULADORA_RTC_PROPRIA_URL;
    const { simplesDisponivel } = await import('@/lib/reforma/simples');
    expect(simplesDisponivel()).toBe(false);
  });
});
