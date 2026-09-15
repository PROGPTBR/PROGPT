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

  it('indicadores/diagnóstico default ON; homologação stays OFF without FISCAL_API_URL', async () => {
    const { isIndicadoresToolEnabled, isDiagnosticoAquisicaoToolEnabled, isHomologacaoQuickToolEnabled } =
      await import('@/lib/chat/inline-chat-tools');
    expect(isIndicadoresToolEnabled()).toBe(true);
    expect(isDiagnosticoAquisicaoToolEnabled()).toBe(true);
    expect(isHomologacaoQuickToolEnabled()).toBe(false);
  });

  it('homologação turns ON once FISCAL_API_URL is configured (and its own kill-switch still gates it)', async () => {
    vi.stubEnv('FISCAL_API_URL', 'https://fiscal.example.com');
    const { isHomologacaoQuickToolEnabled } = await import('@/lib/chat/inline-chat-tools');
    expect(isHomologacaoQuickToolEnabled()).toBe(true);
    vi.stubEnv('CHAT_HOMOLOGACAO_TOOL', 'false');
    vi.resetModules();
    const { isHomologacaoQuickToolEnabled: isHomologacaoQuickToolEnabled2 } = await import(
      '@/lib/chat/inline-chat-tools'
    );
    expect(isHomologacaoQuickToolEnabled2()).toBe(false);
  });

  it('CHAT_INDICADORES_TOOL=false / CHAT_DIAGNOSTICO_AQUISICAO_TOOL=false disable each independently', async () => {
    vi.stubEnv('CHAT_INDICADORES_TOOL', 'false');
    vi.stubEnv('CHAT_DIAGNOSTICO_AQUISICAO_TOOL', 'false');
    const { isIndicadoresToolEnabled, isDiagnosticoAquisicaoToolEnabled, isPrecoReferenciaToolEnabled } =
      await import('@/lib/chat/inline-chat-tools');
    expect(isIndicadoresToolEnabled()).toBe(false);
    expect(isDiagnosticoAquisicaoToolEnabled()).toBe(false);
    expect(isPrecoReferenciaToolEnabled()).toBe(true);
  });
});

describe('createIndicadoresTool', () => {
  it('returns the markdown block when the BACEN lookup succeeds', async () => {
    vi.doMock('@/lib/govdata/indicadores', () => ({
      indicadoresAtuais: vi.fn().mockResolvedValue({
        selic: { codigo: 432, nome: 'Selic (meta)', valor: 10.75, unidade: '% a.a.', data: '01/09/2026' },
        ipca12m: null,
        cambioUsd: { codigo: 1, nome: 'Dólar (venda)', valor: 5.32, unidade: 'R$', data: '15/09/2026' },
      }),
      indicadoresMarkdown: vi.fn().mockReturnValue('## Indicadores econômicos atuais (BACEN — contexto)\n\n- **Selic (meta)**: 10,75% a.a. (01/09/2026)'),
    }));
    const { createIndicadoresTool } = await import('@/lib/chat/inline-chat-tools');
    const usedRef = { current: false };
    const t = createIndicadoresTool({ usedRef });
    const result = await t.execute!({}, { toolCallId: 'x', messages: [] });
    expect(usedRef.current).toBe(true);
    expect(result).toContain('Selic (meta)');
  });

  it('fails soft when the BACEN lookup returns nothing (empty markdown)', async () => {
    vi.doMock('@/lib/govdata/indicadores', () => ({
      indicadoresAtuais: vi.fn().mockResolvedValue({ selic: null, ipca12m: null, cambioUsd: null }),
      indicadoresMarkdown: vi.fn().mockReturnValue(''),
    }));
    const { createIndicadoresTool } = await import('@/lib/chat/inline-chat-tools');
    const t = createIndicadoresTool({ usedRef: { current: false } });
    const result = await t.execute!({}, { toolCallId: 'x', messages: [] });
    expect(result).toContain('Não consegui consultar');
  });

  it('fails soft (never throws) if indicadoresAtuais rejects', async () => {
    vi.doMock('@/lib/govdata/indicadores', () => ({
      indicadoresAtuais: vi.fn().mockRejectedValue(new Error('bacen down')),
      indicadoresMarkdown: vi.fn(),
    }));
    const { createIndicadoresTool } = await import('@/lib/chat/inline-chat-tools');
    const t = createIndicadoresTool({ usedRef: { current: false } });
    await expect(t.execute!({}, { toolCallId: 'x', messages: [] })).resolves.toContain('bacen down');
  });
});

describe('createDiagnosticoAquisicaoTool', () => {
  it('classifies and returns the leaning + KPIs for a CAPEX item', async () => {
    const { createDiagnosticoAquisicaoTool } = await import('@/lib/chat/inline-chat-tools');
    const usedRef = { current: false };
    const t = createDiagnosticoAquisicaoTool({ usedRef });
    const result = await t.execute!(
      {
        descricaoCompra: 'Torno CNC novo',
        natureza: 'produto',
        classificacao: 'CAPEX',
        criticidade: 'alta',
        complexidadeMercado: 'alta',
        impactoOperacional: 'alto',
      },
      { toolCallId: 'x', messages: [] },
    );
    expect(usedRef.current).toBe(true);
    expect(result).toContain('SOURCE');
    expect(result).toContain('TCO');
  });

  it('classifies an OPEX item towards BUY with OPEX KPIs when scores are all low', async () => {
    const { createDiagnosticoAquisicaoTool } = await import('@/lib/chat/inline-chat-tools');
    const t = createDiagnosticoAquisicaoTool({ usedRef: { current: false } });
    const result = await t.execute!(
      {
        descricaoCompra: 'Material de escritório recorrente',
        natureza: 'produto',
        classificacao: 'OPEX',
        criticidade: 'baixa',
        complexidadeMercado: 'baixa',
        impactoOperacional: 'baixo',
      },
      { toolCallId: 'x', messages: [] },
    );
    expect(result).toContain('BUY');
    expect(result).toContain('Saving');
  });
});

describe('createHomologacaoQuickTool', () => {
  it('returns situação cadastral + risk score when both lookups succeed', async () => {
    vi.doMock('@/lib/fiscal/client', () => ({
      isFiscalEnabled: () => true,
      consultarCnpj: vi.fn().mockResolvedValue({
        cnpj: '12345678000199',
        razao_social: 'Fornecedor Exemplo LTDA',
        nome_fantasia: null,
        situacao_cadastral: 'ATIVA',
        porte: 'ME',
      }),
      riskScoreSupplier: vi.fn().mockResolvedValue({
        cnpj: '12345678000199',
        razao_social: 'Fornecedor Exemplo LTDA',
        risco: 'baixo',
        score: 82,
        fatores: ['situação cadastral regular'],
        recomendacao: 'aprovar',
        data_analise: '2026-09-15',
      }),
    }));
    const { createHomologacaoQuickTool } = await import('@/lib/chat/inline-chat-tools');
    const usedRef = { current: false };
    const t = createHomologacaoQuickTool({ usedRef });
    const result = await t.execute!({ cnpj: '12.345.678/0001-99' }, { toolCallId: 'x', messages: [] });
    expect(usedRef.current).toBe(true);
    expect(result).toContain('ATIVA');
    expect(result).toContain('82/100');
  });

  it('fails soft when both lookups reject', async () => {
    vi.doMock('@/lib/fiscal/client', () => ({
      isFiscalEnabled: () => true,
      consultarCnpj: vi.fn().mockRejectedValue(new Error('down')),
      riskScoreSupplier: vi.fn().mockRejectedValue(new Error('down')),
    }));
    const { createHomologacaoQuickTool } = await import('@/lib/chat/inline-chat-tools');
    const t = createHomologacaoQuickTool({ usedRef: { current: false } });
    const result = await t.execute!({ cnpj: '12345678000199' }, { toolCallId: 'x', messages: [] });
    expect(result).toContain('não retornou dados');
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
