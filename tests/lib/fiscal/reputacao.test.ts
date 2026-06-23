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

describe('reputacao (busca web OpenAI)', () => {
  it('HOMOLOGACAO_WEBSEARCH=false desliga (fail-soft, sem chamada)', async () => {
    vi.stubEnv('HOMOLOGACAO_WEBSEARCH', 'false');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const create = vi.fn();
    mockOpenAI(create);
    const { buscarReputacao, isReputacaoEnabled } = await import('@/lib/fiscal/reputacao');
    expect(isReputacaoEnabled()).toBe(false);
    const r = await buscarReputacao({ razaoSocial: 'WEG', cnpj: '84429695000111' });
    expect(r.enabled).toBe(false);
    expect(r.available).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('retorna o resumo da busca quando disponível', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const create = vi.fn().mockResolvedValue({
      output_text: '- Empresa líder de mercado, sem notícias negativas relevantes.',
      usage: { input_tokens: 100, output_tokens: 40 },
    });
    mockOpenAI(create);
    const { buscarReputacao } = await import('@/lib/fiscal/reputacao');
    const r = await buscarReputacao({ razaoSocial: 'WEG S.A.', cnpj: '84429695000111' });
    expect(r.available).toBe(true);
    expect(r.resumo).toContain('líder de mercado');
    expect(create).toHaveBeenCalledTimes(1);
    // usa a tool web_search
    const arg = create.mock.calls[0]![0] as { tools: Array<{ type: string }> };
    expect(arg.tools[0]!.type).toBe('web_search');
  });

  it('erro da API → fail-soft (available:false + error)', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const create = vi.fn().mockRejectedValue(new Error('web search down'));
    mockOpenAI(create);
    const { buscarReputacao } = await import('@/lib/fiscal/reputacao');
    const r = await buscarReputacao({ razaoSocial: 'X', cnpj: '00000000000191' });
    expect(r.available).toBe(false);
    expect(r.error).toContain('web search down');
  });
});
