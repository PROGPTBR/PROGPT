import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  accumulate12m,
  parseBacenNumber,
  resumoIndicadores,
  tendencia,
  painelIndicadores,
  serieIndicador,
  isIndicadorKey,
  FONTES_REFERENCIADAS,
  INDICADOR_POR_CATEGORIA,
  SGS,
} from '@/lib/govdata/indicadores';
import { clearGovDataCache } from '@/lib/govdata/cache';

const json = (obj: unknown) =>
  new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } });

// Série mensal canônica reaproveitada pros mocks de card de nível/índice —
// magnitude típica (pequenas variações %), suficiente pra passar pelo cálculo
// de acumulado 12m e pra popular a série do sparkline.
function mesesFake(n = 18): { data: string; valor: string }[] {
  return Array.from({ length: n }, (_, i) => ({
    data: `01/${String((i % 12) + 1).padStart(2, '0')}/2026`,
    valor: (0.3 + (i % 3) * 0.1).toFixed(2),
  }));
}

/** Stub de fetch cobrindo todos os códigos SGS usados no painel + o Focus OData. */
function stubPainelFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const sgsMatch = url.match(/bcdata\.sgs\.(\d+)/);
      if (sgsMatch) return json(mesesFake());
      if (url.includes('ExpectativasMercadoInflacao12Meses')) {
        return json({
          value: [
            { Data: '2026-08-14', Mediana: 4.37 },
            { Data: '2026-08-13', Mediana: 4.31 },
          ],
        });
      }
      return json([]);
    }),
  );
}

beforeEach(() => clearGovDataCache());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('parseBacenNumber', () => {
  it('converte string com ponto decimal', () => {
    expect(parseBacenNumber('14.25')).toBe(14.25);
    expect(parseBacenNumber('5.1743')).toBeCloseTo(5.1743);
  });
  it('aceita vírgula decimal', () => {
    expect(parseBacenNumber('0,88')).toBeCloseTo(0.88);
  });
  it('retorna null pra valor inválido', () => {
    expect(parseBacenNumber('')).toBeNull();
    expect(parseBacenNumber('x')).toBeNull();
  });
});

describe('accumulate12m (composição de variações mensais)', () => {
  it('compõe 12 variações mensais em acumulado anual', () => {
    // 12 meses de 0,5% cada → (1.005^12 - 1)*100 ≈ 6.17%
    const r = accumulate12m(Array(12).fill(0.5));
    expect(r).toBeCloseTo(6.17, 1);
  });
  it('zero em todos os meses → 0%', () => {
    expect(accumulate12m(Array(12).fill(0))).toBeCloseTo(0, 5);
  });
  it('null quando faltam dados', () => {
    expect(accumulate12m([])).toBeNull();
  });
});

describe('tendencia', () => {
  it('up quando sobe, down quando cai, flat quando estável', () => {
    expect(tendencia([10, 11, 12])).toBe('up');
    expect(tendencia([12, 11, 10])).toBe('down');
    expect(tendencia([10, 10, 10])).toBe('flat');
  });
  it('flat com menos de 2 pontos', () => {
    expect(tendencia([5])).toBe('flat');
    expect(tendencia([])).toBe('flat');
  });
  it('variação ínfima conta como flat', () => {
    expect(tendencia([100, 100.05])).toBe('flat');
  });
});

describe('resumoIndicadores (texto falável)', () => {
  it('monta um resumo curto com os indicadores disponíveis', () => {
    const s = resumoIndicadores({
      selic: { codigo: 432, nome: 'Selic', valor: 14.25, unidade: '% a.a.', data: '05/08/2026' },
      ipca12m: { codigo: 433, nome: 'IPCA 12m', valor: 4.8, unidade: '%', data: '01/05/2026' },
      cambioUsd: { codigo: 1, nome: 'Dólar', valor: 5.17, unidade: 'R$', data: '23/06/2026' },
    });
    expect(s).toMatch(/Selic/i);
    expect(s).toContain('14,25');
    expect(s).toMatch(/IPCA/i);
    expect(s).toContain('4,8');
    expect(s).toContain('5,17');
  });
  it('sinaliza quando nada está disponível', () => {
    expect(resumoIndicadores({ selic: null, ipca12m: null, cambioUsd: null })).toMatch(
      /não.*(disponíve|consegui)/i,
    );
  });
});

// Batch K (backlog do diretor 21/08) — painel cresce de 6 para 10 cards
// (IGP-DI/INCC/IPA via SGS confirmados no doc oficial do BACEN + Focus IPCA
// via Expectativas OData), agrupados em 3 seções, com fonte/link/metodologia
// por card.
describe('painelIndicadores — Batch K', () => {
  beforeEach(() => clearGovDataCache());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('monta 10 cards (6 originais + igpdi/incc/ipa/focus_ipca)', async () => {
    stubPainelFetch();
    const painel = await painelIndicadores();
    expect(painel.disponivel).toBe(true);
    const keys = painel.cards.map((c) => c.key).sort();
    expect(keys).toEqual(
      ['cdi', 'eur', 'focus_ipca', 'igpdi', 'igpm', 'incc', 'ipa', 'ipca', 'selic', 'usd'].sort(),
    );
  });

  it('cada card tem fonte/fonteUrl/periodo/abrangencia/metodologia/consultadoEm/secao preenchidos', async () => {
    stubPainelFetch();
    const painel = await painelIndicadores();
    for (const c of painel.cards) {
      expect(c.fonte.length).toBeGreaterThan(0);
      expect(c.fonteUrl).toMatch(/^https?:\/\//);
      expect(c.periodo.length).toBeGreaterThan(0);
      expect(c.abrangencia.length).toBeGreaterThan(0);
      expect(c.metodologia.length).toBeGreaterThan(0);
      expect(() => new Date(c.consultadoEm).toISOString()).not.toThrow();
      expect(['juros_cambio', 'inflacao_reajuste', 'custos_expectativas']).toContain(c.secao);
    }
  });

  it('o card focus_ipca é tipo "expectativa" e usa a mediana Focus mais recente', async () => {
    stubPainelFetch();
    const painel = await painelIndicadores();
    const focus = painel.cards.find((c) => c.key === 'focus_ipca')!;
    expect(focus.tipo).toBe('expectativa');
    expect(focus.valor).toBe(4.37); // último ponto (mais recente) após reverse()
    expect(focus.secao).toBe('custos_expectativas');
  });

  // Regressão: o endpoint OData de Expectativas (Olinda/BACEN) tem um parser
  // não-conforme — confirmado ao vivo antes de commitar — que rejeita espaço
  // codificado como '+' (exige '%20') e rejeita vírgula %-codificada em
  // `$select` (exige ',' literal). `URLSearchParams` (usado por `govGet` nas
  // outras chamadas) faz as duas coisas "erradas" pra esse servidor
  // específico, por isso a query do Focus é montada à mão — este teste
  // trava esse formato pra não regredir num refactor futuro.
  it('monta a query do Focus sem "+" nos espaços e sem vírgula %-codificada no $select', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('ExpectativasMercadoInflacao12Meses')) capturedUrl = url;
        if (url.match(/bcdata\.sgs\.(\d+)/)) return json(mesesFake());
        if (url.includes('ExpectativasMercadoInflacao12Meses')) {
          return json({ value: [{ Data: '2026-08-14', Suavizada: 'N', Mediana: 4.37 }] });
        }
        return json([]);
      }),
    );
    await painelIndicadores();
    expect(capturedUrl).toContain('%20'); // espaço correto
    expect(capturedUrl).not.toMatch(/\$filter=\S*\+/); // sem '+' no lugar de espaço
    expect(capturedUrl).toContain('Data,Suavizada,Mediana'); // vírgula literal, não %2C
  });

  it('SGS codes de igpdi/incc/ipa batem com os confirmados no doc oficial do BACEN', () => {
    expect(SGS.IGP_DI_MENSAL).toBe(190);
    expect(SGS.INCC_MENSAL).toBe(192);
    expect(SGS.IPA_MENSAL).toBe(7450);
  });
});

describe('isIndicadorKey / serieIndicador — Batch K', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('aceita as novas chaves SGS (igpdi/incc/ipa) mas rejeita focus_ipca (sem série SGS)', () => {
    expect(isIndicadorKey('igpdi')).toBe(true);
    expect(isIndicadorKey('incc')).toBe(true);
    expect(isIndicadorKey('ipa')).toBe(true);
    expect(isIndicadorKey('focus_ipca')).toBe(false);
  });

  it('serieIndicador funciona pra igpdi (drill-down do dashboard)', async () => {
    clearGovDataCache();
    stubPainelFetch();
    const pontos = await serieIndicador('igpdi', 12);
    expect(pontos.length).toBeGreaterThan(0);
  });
});

describe('Fontes referenciadas e tabela categoria→indicador (Batch K)', () => {
  it('FONTES_REFERENCIADAS tem as fontes do doc, cada uma com url http(s)', () => {
    expect(FONTES_REFERENCIADAS.length).toBeGreaterThanOrEqual(6);
    for (const f of FONTES_REFERENCIADAS) {
      expect(f.fonte.length).toBeGreaterThan(0);
      expect(f.url).toMatch(/^https?:\/\//);
    }
  });

  it('INDICADOR_POR_CATEGORIA cobre as categorias do doc do diretor', () => {
    const categorias = INDICADOR_POR_CATEGORIA.map((r) => r.categoria);
    expect(categorias).toContain('Construção civil');
    expect(categorias).toContain('Transporte rodoviário');
    expect(categorias).toContain('Contratos de aluguel');
  });
});
