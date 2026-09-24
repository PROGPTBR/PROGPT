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

type DbRow = {
  codigo: string;
  denominacao: string;
  score: number;
  exemplos?: string | null;
  exato?: number;
};

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

// Feedback de cliente em 24/09/2026: buscou "locação de caçambas de entulho"
// e a plataforma devolveu uma locadora de compressores (CNAE 7719-5/99,
// "Locação de outros meios de transporte"). Causa provada reproduzindo o
// passo de escolha: o LLM recebia só `código — nome`, e o nome oficial do
// CNAE é jurídico demais pra distinguir. Com os EXEMPLOS de atividade (que o
// banco já tinha e o código descartava) ele acerta.
describe('cnae-classifier — exemplos de atividade chegam na escolha', () => {
  const extracao = {
    text: JSON.stringify({
      activityDescription: 'locação de caçambas de entulho',
      scope: 'city',
      cities: ['Itupeva'],
      states: ['SP'],
    }),
  };

  const candidatos: DbRow[] = [
    {
      codigo: '7719599',
      denominacao: 'Locação de outros meios de transporte não especificados anteriormente, sem condutor',
      score: 0.9,
      exemplos: 'aluguel de contêineres; locação de vagões',
      exato: 0,
    },
    {
      codigo: '3811400',
      denominacao: 'Coleta de resíduos não-perigosos',
      score: 0.4,
      exemplos: 'coleta de entulho; locação de caçambas para entulho',
      exato: 1,
    },
  ];

  it('inclui os exemplos no prompt de escolha do CNAE', async () => {
    const { create } = mockOpenAI([
      extracao,
      { text: JSON.stringify({ cnaeCode: '3811400', confidence: 0.9, rationale: 'caçamba de entulho é coleta de resíduos' }) },
    ]);
    mockReceitaSql(candidatos);

    const { classifyCnae } = await import('@/lib/suppliers/cnae-classifier');
    await classifyCnae('locação de caçambas de entulho em Itupeva SP');

    const promptDoPick = JSON.stringify(create.mock.calls[1]?.[0]);
    expect(promptDoPick).toContain('locação de caçambas para entulho');
    // Sem isto o modelo escolhe pelo nome jurídico e erra.
    expect(promptDoPick).toContain('Exemplos:');
  });

  it('devolve os exemplos do CNAE escolhido pra UI poder mostrar', async () => {
    mockOpenAI([
      extracao,
      { text: JSON.stringify({ cnaeCode: '3811400', confidence: 0.9, rationale: 'ok' }) },
    ]);
    mockReceitaSql(candidatos);

    const { classifyCnae } = await import('@/lib/suppliers/cnae-classifier');
    const r = await classifyCnae('caçamba de entulho');

    expect(r.cnaeCode).toBe('3811400');
    expect(r.cnaeExamples).toContain('entulho');
  });

  it('carrega exemplos também nas alternativas (o comprador escolhe por elas)', async () => {
    mockOpenAI([
      extracao,
      { text: JSON.stringify({ cnaeCode: '3811400', confidence: 0.9, rationale: 'ok' }) },
    ]);
    mockReceitaSql(candidatos);

    const { classifyCnae } = await import('@/lib/suppliers/cnae-classifier');
    const r = await classifyCnae('caçamba de entulho');

    expect(r.alternatives).toHaveLength(1);
    expect(r.alternatives[0]!.code).toBe('7719599');
    expect(r.alternatives[0]!.examples).toContain('contêineres');
  });

  it('não quebra quando o CNAE não tem exemplos cadastrados', async () => {
    mockOpenAI([
      extracao,
      { text: JSON.stringify({ cnaeCode: '7719599', confidence: 0.5, rationale: 'ok' }) },
    ]);
    mockReceitaSql([
      { codigo: '7719599', denominacao: 'Locação de outros meios de transporte', score: 0.9, exemplos: null, exato: 0 },
    ]);

    const { classifyCnae } = await import('@/lib/suppliers/cnae-classifier');
    const r = await classifyCnae('qualquer coisa');

    expect(r.cnaeCode).toBe('7719599');
    expect(r.cnaeExamples).toBeUndefined();
  });
});

// Segundo achado do mesmo dia, testando contra o banco real: a correção dos
// exemplos resolvia só quando o CNAE certo já era candidato. Com "locação de
// caçambas de entulho", a palavra "locação" afogava "caçamba"/"entulho" e o
// 3811400 nem aparecia na lista — a busca voltava errada com 80% de
// confiança. A segunda passada, sem as palavras genéricas de negócio,
// resolve. Validado ao vivo: passou a devolver 3811400.
describe('termosDistintivos', () => {
  it('descarta palavras de negócio que aparecem em dezenas de CNAEs', async () => {
    const { termosDistintivos } = await import('@/lib/suppliers/cnae-classifier');
    expect(termosDistintivos('locação de caçambas de entulho')).toBe('caçambas entulho');
    expect(termosDistintivos('fornecimento de embalagens plásticas')).toBe(
      'embalagens plásticas',
    );
  });

  it('preserva o termo que identifica a atividade', async () => {
    const { termosDistintivos } = await import('@/lib/suppliers/cnae-classifier');
    expect(termosDistintivos('locação de andaimes')).toBe('andaimes');
    expect(termosDistintivos('aluguel de betoneira')).toBe('betoneira');
  });

  it('devolve vazio quando a frase inteira é genérica (não vale 2ª busca)', async () => {
    const { termosDistintivos } = await import('@/lib/suppliers/cnae-classifier');
    expect(termosDistintivos('fornecimento de serviços')).toBe('');
    expect(termosDistintivos('de para com')).toBe('');
  });
});

describe('cnae-classifier — duas passadas de busca', () => {
  it('une os candidatos das duas buscas, sem repetir', async () => {
    mockOpenAI([
      {
        text: JSON.stringify({
          activityDescription: 'locação de caçambas de entulho',
          scope: 'national',
        }),
      },
      { text: JSON.stringify({ cnaeCode: '3811400', confidence: 0.9, rationale: 'ok' }) },
    ]);

    // O fake devolve a MESMA lista nas duas passadas; o resultado não pode
    // duplicar os códigos.
    mockReceitaSql([
      { codigo: '7719599', denominacao: 'Locação de outros meios de transporte', score: 0.9, exemplos: 'contêineres', exato: 0 },
      { codigo: '3811400', denominacao: 'Coleta de resíduos não-perigosos', score: 0.5, exemplos: 'entulho; caçambas', exato: 1 },
    ]);

    const { classifyCnae } = await import('@/lib/suppliers/cnae-classifier');
    const r = await classifyCnae('locação de caçambas de entulho');

    const codigos = [r.cnaeCode, ...r.alternatives.map((a) => a.code)];
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(r.cnaeCode).toBe('3811400');
  });
});
