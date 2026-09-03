import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe('kill-switches', () => {
  it('default ON when env vars are unset', async () => {
    const {
      isOffTopicFallbackEnabled,
      isChatToolWebSearchEnabled,
      isPrecoReferenciaToolEnabled,
    } = await import('@/lib/chat/inline-chat-tools');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    expect(isOffTopicFallbackEnabled()).toBe(true);
    expect(isChatToolWebSearchEnabled()).toBe(true);
    expect(isPrecoReferenciaToolEnabled()).toBe(true);
  });

  it('CHAT_OFF_TOPIC_FALLBACK=false also disables the web search sub-toggle', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    vi.stubEnv('CHAT_OFF_TOPIC_FALLBACK', 'false');
    const { isOffTopicFallbackEnabled, isChatToolWebSearchEnabled } = await import(
      '@/lib/chat/inline-chat-tools'
    );
    expect(isOffTopicFallbackEnabled()).toBe(false);
    expect(isChatToolWebSearchEnabled()).toBe(false);
  });

  it('CHAT_TOOL_WEBSEARCH=false disables only web search, not the off-topic fallback', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    vi.stubEnv('CHAT_TOOL_WEBSEARCH', 'false');
    const { isOffTopicFallbackEnabled, isChatToolWebSearchEnabled } = await import(
      '@/lib/chat/inline-chat-tools'
    );
    expect(isOffTopicFallbackEnabled()).toBe(true);
    expect(isChatToolWebSearchEnabled()).toBe(false);
  });

  it('CHAT_PRECO_REFERENCIA_TOOL=false disables just the price tool', async () => {
    vi.stubEnv('CHAT_PRECO_REFERENCIA_TOOL', 'false');
    const { isPrecoReferenciaToolEnabled } = await import('@/lib/chat/inline-chat-tools');
    expect(isPrecoReferenciaToolEnabled()).toBe(false);
  });
});

describe('createOffBaseMarkerTool', () => {
  it('flips usedRef and never throws (no real work, marker only)', async () => {
    const { createOffBaseMarkerTool } = await import('@/lib/chat/inline-chat-tools');
    const usedRef = { current: false };
    const t = createOffBaseMarkerTool(usedRef);
    const result = await t.execute!({}, { toolCallId: 'x', messages: [] });
    expect(usedRef.current).toBe(true);
    expect(typeof result).toBe('string');
  });
});

describe('createPrecoReferenciaTool', () => {
  it('returns price stats when buscarCatmat and precoReferencia both succeed', async () => {
    vi.doMock('@/lib/govdata/precos', () => ({
      buscarCatmat: vi.fn().mockResolvedValue({
        codigoItem: 123,
        descricaoItem: 'Papel A4 75g',
        codigoClasse: 1,
        nomeClasse: 'Papel',
        codigoPdm: 2,
        nomePdm: 'Papel A4',
        confianca: 0.9,
        rationale: 'match direto',
      }),
      precoReferencia: vi.fn().mockResolvedValue({
        codigoItem: 123,
        stats: { mediana: 25.5, p25: 20, p75: 30, min: 15, max: 40, n: 18, nBruto: 20, outliersRemovidos: 2 },
        amostras: [],
        totalAmostras: 20,
      }),
    }));
    const { createPrecoReferenciaTool } = await import('@/lib/chat/inline-chat-tools');
    const usedRef = { current: false };
    const t = createPrecoReferenciaTool({ usedRef });
    const result = await t.execute!({ descricao: 'papel A4' }, { toolCallId: 'x', messages: [] });
    expect(usedRef.current).toBe(true);
    expect(result).toContain('25.5');
    expect(result).toContain('123');
  });

  it('fails soft when buscarCatmat finds no match (returns null)', async () => {
    vi.doMock('@/lib/govdata/precos', () => ({
      buscarCatmat: vi.fn().mockResolvedValue(null),
      precoReferencia: vi.fn(),
    }));
    const { createPrecoReferenciaTool } = await import('@/lib/chat/inline-chat-tools');
    const t = createPrecoReferenciaTool({ usedRef: { current: false } });
    const result = await t.execute!({ descricao: 'item inexistente' }, { toolCallId: 'x', messages: [] });
    expect(result).toContain('Não encontrei');
  });

  it('fails soft when precoReferencia has no stats (no samples)', async () => {
    vi.doMock('@/lib/govdata/precos', () => ({
      buscarCatmat: vi.fn().mockResolvedValue({
        codigoItem: 123,
        descricaoItem: 'Item raro',
        codigoClasse: 1,
        nomeClasse: 'X',
        codigoPdm: 2,
        nomePdm: 'Y',
        confianca: 0.5,
        rationale: 'r',
      }),
      precoReferencia: vi.fn().mockResolvedValue({ codigoItem: 123, stats: null, amostras: [], totalAmostras: 0 }),
    }));
    const { createPrecoReferenciaTool } = await import('@/lib/chat/inline-chat-tools');
    const t = createPrecoReferenciaTool({ usedRef: { current: false } });
    const result = await t.execute!({ descricao: 'item raro' }, { toolCallId: 'x', messages: [] });
    expect(result).toContain('não há preços praticados');
  });

  it('fails soft (never throws) even if buscarCatmat itself unexpectedly throws', async () => {
    vi.doMock('@/lib/govdata/precos', () => ({
      buscarCatmat: vi.fn().mockRejectedValue(new Error('api down')),
      precoReferencia: vi.fn(),
    }));
    const { createPrecoReferenciaTool } = await import('@/lib/chat/inline-chat-tools');
    const t = createPrecoReferenciaTool({ usedRef: { current: false } });
    // buscarCatmat/precoReferencia are documented fail-soft (never throw in
    // prod), but the tool wrapper defends anyway — a throw here must never
    // escape execute() and abort the whole chat stream.
    await expect(
      t.execute!({ descricao: 'x' }, { toolCallId: 'x', messages: [] }),
    ).resolves.toContain('api down');
  });
});
