import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  vi.resetModules();
});

type MockResp = { text?: string; throws?: Error };

function mockOpenAI(responses: MockResp[]) {
  let i = 0;
  const create = vi.fn().mockImplementation(async () => {
    const r = responses[i++] ?? responses[responses.length - 1];
    if (!r) throw new Error('no mock response');
    if (r.throws) throw r.throws;
    return { choices: [{ message: { content: r.text ?? '' } }], usage: {} };
  });
  vi.doMock('@/lib/llm/openai', () => ({
    getOpenAI: () => ({ chat: { completions: { create } } }),
    getOpenAIModel: () => 'gpt-4o-mini',
  }));
  return { create };
}

type DbRow = { codigo: string; denominacao: string; score: number };

function mockReceitaSql(rows: DbRow[]) {
  const tagged = (() => Promise.resolve(rows)) as unknown;
  vi.doMock('@/lib/suppliers/receita-db', () => ({
    getReceitaSql: () => tagged,
  }));
}

// Silence the fire-and-forget api usage recorder.
vi.mock('@/lib/observability/api-usage', () => ({
  recordApiUsage: vi.fn(),
}));

describe('cnae-classifier', () => {
  it('returns null result + confidence 0 when extract step fails', async () => {
    mockOpenAI([{ throws: new Error('boom') }]);
    mockReceitaSql([]);
    const { classifyCnae } = await import('@/lib/suppliers/cnae-classifier');
    const result = await classifyCnae('embalagens flexíveis no Nordeste');
    expect(result.cnaeCode).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.alternatives).toEqual([]);
  });

  it('returns confidence 0 when FTS returns no candidates', async () => {
    mockOpenAI([
      {
        text: JSON.stringify({
          activityDescription: 'fabricação de embalagens',
          scope: 'regional',
          states: ['BA', 'PE'],
        }),
      },
    ]);
    mockReceitaSql([]);
    const { classifyCnae } = await import('@/lib/suppliers/cnae-classifier');
    const result = await classifyCnae('embalagens no NE');
    expect(result.cnaeCode).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.scope).toBe('regional');
    expect(result.states).toEqual(['BA', 'PE']);
  });

  it('happy path: extract + FTS + pick produce a chosen CNAE', async () => {
    mockOpenAI([
      {
        text: JSON.stringify({
          activityDescription: 'fabricação de embalagens plásticas',
          scope: 'regional',
          states: ['BA', 'PE', 'CE'],
        }),
      },
      {
        text: JSON.stringify({
          cnaeCode: '2222600',
          confidence: 0.85,
          rationale: 'Match direto com embalagens plásticas.',
        }),
      },
    ]);
    mockReceitaSql([
      { codigo: '2222600', denominacao: 'Fabricação de embalagens de material plástico', score: 0.78 },
      { codigo: '2229302', denominacao: 'Fabricação de artefatos de material plástico', score: 0.66 },
      { codigo: '4686901', denominacao: 'Comércio atacadista de embalagens', score: 0.55 },
    ]);
    const { classifyCnae } = await import('@/lib/suppliers/cnae-classifier');
    const result = await classifyCnae('embalagens flexíveis no Nordeste');
    expect(result.cnaeCode).toBe('2222600');
    expect(result.cnaeName).toMatch(/embalagens/i);
    expect(result.confidence).toBeCloseTo(0.85);
    expect(result.scope).toBe('regional');
    expect(result.states).toEqual(['BA', 'PE', 'CE']);
    expect(result.alternatives.length).toBe(2);
    expect(result.alternatives.map((a) => a.code)).not.toContain('2222600');
  });

  it('returns confidence 0 when LLM pick returns cnaeCode=null', async () => {
    mockOpenAI([
      {
        text: JSON.stringify({
          activityDescription: 'foo',
          scope: 'national',
        }),
      },
      {
        text: JSON.stringify({ cnaeCode: null, confidence: 0, rationale: 'nada bate' }),
      },
    ]);
    mockReceitaSql([
      { codigo: '1111111', denominacao: 'X', score: 0.5 },
    ]);
    const { classifyCnae } = await import('@/lib/suppliers/cnae-classifier');
    const result = await classifyCnae('foo');
    expect(result.cnaeCode).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.alternatives.length).toBe(1);
  });

  it('falls back to top candidate when LLM picks unknown code', async () => {
    mockOpenAI([
      {
        text: JSON.stringify({
          activityDescription: 'foo',
          scope: 'national',
        }),
      },
      {
        text: JSON.stringify({
          cnaeCode: '9999999',
          confidence: 0.8,
          rationale: 'inventado',
        }),
      },
    ]);
    mockReceitaSql([
      { codigo: '1111111', denominacao: 'Real CNAE', score: 0.8 },
    ]);
    const { classifyCnae } = await import('@/lib/suppliers/cnae-classifier');
    const result = await classifyCnae('foo');
    // LLM returned a code not in the candidate list — fallback uses top candidate.
    expect(result.cnaeCode).toBe('1111111');
  });

  it('normalizes UFs to canonical 2-letter codes', async () => {
    mockOpenAI([
      {
        text: JSON.stringify({
          activityDescription: 'foo',
          scope: 'state',
          states: ['sp', 'mg', 'XX', 'rj'],
        }),
      },
      {
        text: JSON.stringify({ cnaeCode: '1111111', confidence: 0.7, rationale: 'ok' }),
      },
    ]);
    mockReceitaSql([{ codigo: '1111111', denominacao: 'X', score: 0.7 }]);
    const { classifyCnae } = await import('@/lib/suppliers/cnae-classifier');
    const result = await classifyCnae('foo');
    expect(result.states).toEqual(['SP', 'MG', 'RJ']);
  });
});
