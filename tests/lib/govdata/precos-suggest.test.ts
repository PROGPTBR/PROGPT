import { describe, it, expect, vi, beforeEach } from 'vitest';

// Autocomplete do catálogo CATMAT: rankByRelevance (puro) + suggestCatmatItems
// (navega Classe→PDM via LLM e devolve os itens do PDM rankeados). O catálogo
// NÃO tem busca textual, então o ranking local é o que aproxima a sugestão.

vi.mock('@/lib/observability/api-usage', () => ({ recordApiUsage: vi.fn() }));

const create = vi.fn();
vi.mock('@/lib/llm/openai', () => ({
  getOpenAI: () => ({ chat: { completions: { create } } }),
  getOpenAIModel: () => 'gpt-4o-mini',
}));

const listClasses = vi.fn();
const listPdms = vi.fn();
const listItemsByPdm = vi.fn();
vi.mock('@/lib/govdata/catalog', () => ({
  listClasses: () => listClasses(),
  listPdms: (c: number) => listPdms(c),
  listItemsByPdm: (p: number) => listItemsByPdm(p),
}));

import { rankByRelevance, suggestCatmatItems } from '@/lib/govdata/precos';

const pick = (codigo: number | null) => ({
  choices: [{ message: { content: JSON.stringify({ codigo, confianca: 0.8, rationale: 'r' }) } }],
  usage: { prompt_tokens: 1, completion_tokens: 1 },
});

beforeEach(() => {
  create.mockReset();
  listClasses.mockReset();
  listPdms.mockReset();
  listItemsByPdm.mockReset();
});

describe('rankByRelevance', () => {
  const itens = [
    { codigoItem: 1, descricaoItem: 'SAL REFINADO IODADO' },
    { codigoItem: 2, descricaoItem: 'AÇÚCAR, TIPO: REFINADO, EMBALAGEM 1KG' },
    { codigoItem: 3, descricaoItem: 'AÇÚCAR CRISTAL' },
  ];

  it('coloca o item com mais tokens em comum no topo', () => {
    const r = rankByRelevance('açúcar refinado 1kg', itens, 15);
    expect(r[0]!.codigoItem).toBe(2); // açúcar + refinado + 1kg
  });

  it('é insensível a acento e caixa', () => {
    const r = rankByRelevance('ACUCAR', itens, 15);
    expect(r[0]!.descricaoItem).toMatch(/AÇÚCAR/);
  });

  it('respeita o limite', () => {
    expect(rankByRelevance('açúcar', itens, 1)).toHaveLength(1);
  });

  it('desempata pela descrição mais curta', () => {
    const tie = [
      { codigoItem: 10, descricaoItem: 'AÇÚCAR PARA CONFEITARIA ESPECIAL' },
      { codigoItem: 11, descricaoItem: 'AÇÚCAR' },
    ];
    const r = rankByRelevance('açúcar', tie, 15);
    expect(r[0]!.codigoItem).toBe(11);
  });
});

describe('suggestCatmatItems', () => {
  it('retorna null para texto curto (< 3 chars) sem tocar a API', async () => {
    expect(await suggestCatmatItems('ab')).toBeNull();
    expect(listClasses).not.toHaveBeenCalled();
  });

  it('navega Classe→PDM e devolve os itens do PDM rankeados', async () => {
    listClasses.mockResolvedValue([
      { codigoClasse: 8925, nomeClasse: 'AÇÚCAR E SIMILARES' },
      { codigoClasse: 1000, nomeClasse: 'OUTRA CLASSE' },
    ]);
    listPdms.mockResolvedValue([
      { codigoPdm: 19777, nomePdm: 'AÇÚCAR' },
      { codigoPdm: 2, nomePdm: 'OUTRO PDM' },
    ]);
    listItemsByPdm.mockResolvedValue([
      { codigoItem: 1, descricaoItem: 'AÇÚCAR CRISTAL' },
      { codigoItem: 463998, descricaoItem: 'AÇÚCAR, TIPO: REFINADO' },
    ]);
    create.mockResolvedValueOnce(pick(8925)).mockResolvedValueOnce(pick(19777));

    const r = await suggestCatmatItems('açúcar refinado');
    expect(r).not.toBeNull();
    expect(r!.codigoClasse).toBe(8925);
    expect(r!.codigoPdm).toBe(19777);
    expect(r!.itens).toHaveLength(2);
    expect(r!.itens[0]!.codigoItem).toBe(463998); // "refinado" ranqueia no topo
    expect(listItemsByPdm).toHaveBeenCalledWith(19777);
  });

  it('fail-soft: erro na API do catálogo → null', async () => {
    listClasses.mockRejectedValue(new Error('gov down'));
    expect(await suggestCatmatItems('açúcar refinado')).toBeNull();
  });

  it('null quando o LLM não encaixa nenhuma classe', async () => {
    listClasses.mockResolvedValue([
      { codigoClasse: 1, nomeClasse: 'A' },
      { codigoClasse: 2, nomeClasse: 'B' },
    ]);
    create.mockResolvedValueOnce(pick(null));
    expect(await suggestCatmatItems('coisa inexistente xyz')).toBeNull();
    expect(listPdms).not.toHaveBeenCalled();
  });
});
