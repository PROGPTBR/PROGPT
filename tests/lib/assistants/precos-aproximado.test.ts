import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

function mockOpenAI(create: ReturnType<typeof vi.fn>) {
  vi.doMock('@/lib/llm/openai', () => ({
    getOpenAI: () => ({ responses: { create } }),
    getOpenAIModel: () => 'gpt-4o-mini',
  }));
  vi.doMock('@/lib/observability/api-usage', () => ({ recordApiUsage: vi.fn() }));
}

describe('precos-aproximado (busca web OpenAI)', () => {
  it('PRECOS_WEBSEARCH=false desliga (fail-soft, sem chamada)', async () => {
    vi.stubEnv('PRECOS_WEBSEARCH', 'false');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const create = vi.fn();
    mockOpenAI(create);
    const { buscarPrecoAproximado, isPrecosAproximadoEnabled } = await import(
      '@/lib/assistants/precos-aproximado'
    );
    expect(isPrecosAproximadoEnabled()).toBe(false);
    const r = await buscarPrecoAproximado({ descricao: 'caneta esferográfica azul' });
    expect(r.enabled).toBe(false);
    expect(r.available).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('sem OPENAI_API_KEY → desligado', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { isPrecosAproximadoEnabled } = await import('@/lib/assistants/precos-aproximado');
    expect(isPrecosAproximadoEnabled()).toBe(false);
  });

  it('retorna preço + NCM quando a busca devolve JSON válido', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        precoUnitario: 1.2,
        unidade: 'unidade',
        ncm: '96081000',
        ncmDescricao: 'Canetas esferográficas',
        fontes: [{ titulo: 'Kalunga', url: 'https://kalunga.com.br/x' }],
        confianca: 0.7,
        observacao: 'Preço varia de R$ 0,85 a R$ 1,20 dependendo do volume.',
      }),
      usage: { input_tokens: 200, output_tokens: 80 },
    });
    mockOpenAI(create);
    const { buscarPrecoAproximado } = await import('@/lib/assistants/precos-aproximado');
    const r = await buscarPrecoAproximado({ descricao: 'caneta bic azul', unidade: 'unidade' });
    expect(r.available).toBe(true);
    expect(r.precoUnitario).toBe(1.2);
    expect(r.ncm).toBe('96081000');
    expect(r.fontes).toHaveLength(1);
    expect(r.fontes[0]!.titulo).toBe('Kalunga');
    expect(r.confianca).toBe(0.7);
    // usa a tool web_search
    const arg = create.mock.calls[0]![0] as { tools: Array<{ type: string }> };
    expect(arg.tools[0]!.type).toBe('web_search');
  });

  it('tolera JSON envolto em code fence/preâmbulo', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const create = vi.fn().mockResolvedValue({
      output_text: 'Aqui está a estimativa:\n```json\n{"precoUnitario": 5, "ncm": null}\n```',
      usage: {},
    });
    mockOpenAI(create);
    const { buscarPrecoAproximado } = await import('@/lib/assistants/precos-aproximado');
    const r = await buscarPrecoAproximado({ descricao: 'item qualquer' });
    expect(r.available).toBe(true);
    expect(r.precoUnitario).toBe(5);
    expect(r.ncm).toBeNull();
  });

  it('JSON inválido/ausente → fail-soft (available:false + error)', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const create = vi.fn().mockResolvedValue({ output_text: 'não encontrei nada útil', usage: {} });
    mockOpenAI(create);
    const { buscarPrecoAproximado } = await import('@/lib/assistants/precos-aproximado');
    const r = await buscarPrecoAproximado({ descricao: 'item qualquer' });
    expect(r.available).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('erro da API → fail-soft (available:false + error)', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const create = vi.fn().mockRejectedValue(new Error('web search down'));
    mockOpenAI(create);
    const { buscarPrecoAproximado } = await import('@/lib/assistants/precos-aproximado');
    const r = await buscarPrecoAproximado({ descricao: 'item qualquer' });
    expect(r.available).toBe(false);
    expect(r.error).toContain('web search down');
  });

  it('precoUnitario e ncm ambos null → available:false', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({ precoUnitario: null, ncm: null, observacao: 'sem dados' }),
      usage: {},
    });
    mockOpenAI(create);
    const { buscarPrecoAproximado } = await import('@/lib/assistants/precos-aproximado');
    const r = await buscarPrecoAproximado({ descricao: 'item raro' });
    expect(r.available).toBe(false);
    expect(r.observacao).toBe('sem dados');
  });
});
