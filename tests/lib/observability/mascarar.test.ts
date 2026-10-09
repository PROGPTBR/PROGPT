import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mascararConteudo } from '@/lib/observability/mascarar';

describe('mascararConteudo', () => {
  it('omite mensagens da conversa e texto de anexo', () => {
    const r = mascararConteudo({
      messages: [{ role: 'user', content: 'Contrato da Construtora X, valor 2 milhões' }],
      perfilName: 'Aço longo para obra',
    }) as Record<string, unknown>;
    expect(JSON.stringify(r)).not.toContain('Construtora');
    expect(JSON.stringify(r)).not.toContain('Aço');
    expect(r.messages).toBe('[conteúdo omitido: 1 itens]');
    expect(r.perfilName).toMatch(/^\[texto omitido: \d+ caracteres\]$/);
  });

  it('omite chave de conteúdo mesmo quando o texto é curto', () => {
    expect(mascararConteudo({ query: 'aço' })).toEqual({ query: '[texto omitido: 3 caracteres]' });
  });

  it('mantém métricas e rótulos técnicos', () => {
    expect(
      mascararConteudo({ systemLen: 1200, candidates: 30, mode: 'library_overview', model: 'gpt-5.4-mini', ok: true, x: null }),
    ).toEqual({ systemLen: 1200, candidates: 30, mode: 'library_overview', model: 'gpt-5.4-mini', ok: true, x: null });
  });

  it('omite frase em chave desconhecida', () => {
    expect(mascararConteudo({ novoCampo: 'qual o preço do vergalhão' })).toEqual({
      novoCampo: '[texto omitido: 25 caracteres]',
    });
  });

  it('desce em listas e objetos aninhados', () => {
    const r = mascararConteudo({ classification: { intent: 'definition', theory: 'kraljic', language: 'pt' }, scores: [0.9, 0.4] });
    expect(r).toEqual({ classification: { intent: 'definition', theory: 'kraljic', language: 'pt' }, scores: [0.9, 0.4] });
  });
});

describe('startTrace não envia conteúdo ao Langfuse', () => {
  const orig = { pub: process.env.LANGFUSE_PUBLIC_KEY, sec: process.env.LANGFUSE_SECRET_KEY };
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env.LANGFUSE_PUBLIC_KEY = orig.pub;
    process.env.LANGFUSE_SECRET_KEY = orig.sec;
  });

  it('mascara input do trace, span e saída', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pub';
    process.env.LANGFUSE_SECRET_KEY = 'sec';
    const enviado: unknown[] = [];
    const end = vi.fn((p: unknown) => enviado.push(p));
    vi.doMock('langfuse', () => ({
      Langfuse: vi.fn().mockImplementation(() => ({
        trace: vi.fn((p: unknown) => {
          enviado.push(p);
          return {
            id: 't',
            update: vi.fn((u: unknown) => enviado.push(u)),
            span: vi.fn((s: unknown) => {
              enviado.push(s);
              return { end };
            }),
          };
        }),
        flushAsync: vi.fn(),
      })),
    }));
    const { startTrace } = await import('@/lib/observability/langfuse');
    const t = await startTrace({ name: 'chat.turn', input: { messages: [{ role: 'user', content: 'segredo comercial' }] } });
    t.span('condense', { messages: ['segredo comercial'] }).end({ text: 'segredo comercial', ms: 40 });
    t.end({ answer: 'segredo comercial' });
    const json = JSON.stringify(enviado);
    expect(json).not.toContain('segredo');
    expect(json).toContain('"ms":40');
  });
});
