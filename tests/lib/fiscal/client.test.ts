import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isFiscalEnabled,
  consultarCnpj,
  riskScoreSupplier,
  analyzeCnpjCompliance,
  compareTaxRegimes,
  fiscalHealthcheck,
  FiscalError,
} from '@/lib/fiscal/client';
import { clearFiscalCache } from '@/lib/fiscal/cache';

// Fase 0 — cliente do mcp-fiscal-brasil. Padrão dos testes de billing/asaas:
// stub global fetch + stubEnv. O cliente lê process.env de forma preguiçosa,
// então stubEnv funciona sem resetModules. Cache é limpo entre testes.

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  clearFiscalCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('fiscal client — config / fail-soft', () => {
  it('isFiscalEnabled é false sem FISCAL_API_URL e true com ela', () => {
    vi.stubEnv('FISCAL_API_URL', '');
    expect(isFiscalEnabled()).toBe(false);
    vi.stubEnv('FISCAL_API_URL', 'http://fiscal.local:8000');
    expect(isFiscalEnabled()).toBe(true);
  });

  it('lança FiscalError quando FISCAL_API_URL está ausente (feature off)', async () => {
    vi.stubEnv('FISCAL_API_URL', '');
    await expect(consultarCnpj('00.000.000/0001-91')).rejects.toBeInstanceOf(
      FiscalError,
    );
  });
});

describe('fiscal client — chamadas tipadas', () => {
  it('consultarCnpj normaliza o CNPJ pra dígitos e monta a URL certa', async () => {
    vi.stubEnv('FISCAL_API_URL', 'http://fiscal.local:8000/');
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(json({ cnpj: '00000000000191', razao_social: 'X' }));
    vi.stubGlobal('fetch', fetchSpy);

    const data = await consultarCnpj('00.000.000/0001-91');
    expect(data.razao_social).toBe('X');
    const [url] = fetchSpy.mock.calls[0]! as [string];
    // barra final do base removida + dígitos só
    expect(url).toBe('http://fiscal.local:8000/v1/cnpj/00000000000191');
  });

  it('riskScoreSupplier adiciona ?estrito=true quando estrito', async () => {
    vi.stubEnv('FISCAL_API_URL', 'http://fiscal.local:8000');
    const fetchSpy = vi.fn().mockResolvedValue(
      json({ cnpj: '00000000000191', razao_social: 'X', risco: 'baixo', score: 80, fatores: [], recomendacao: 'aprovar', data_analise: '2026-06-22' }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const r = await riskScoreSupplier('00000000000191', true);
    expect(r.score).toBe(80);
    expect(r.recomendacao).toBe('aprovar');
    const [url] = fetchSpy.mock.calls[0]! as [string];
    expect(url).toContain('/v1/agentic/supplier/00000000000191?estrito=true');
  });

  it('compareTaxRegimes monta a query (faturamento + setor + folha opcional)', async () => {
    vi.stubEnv('FISCAL_API_URL', 'http://fiscal.local:8000');
    const fetchSpy = vi.fn().mockResolvedValue(json({ melhor_opcao: 'simples_nacional', opcoes: [] }));
    vi.stubGlobal('fetch', fetchSpy);

    await compareTaxRegimes({ faturamentoAnual: 1200000, setor: 'serviços', folhaPagamentoAnual: 240000 });
    const [url] = fetchSpy.mock.calls[0]! as [string];
    expect(url).toContain('faturamento_anual=1200000');
    expect(url).toContain('setor=');
    expect(url).toContain('folha_pagamento_anual=240000');
  });

  it('erro HTTP vira FiscalError com o status', async () => {
    vi.stubEnv('FISCAL_API_URL', 'http://fiscal.local:8000');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 503 })));
    await expect(analyzeCnpjCompliance('00000000000191')).rejects.toMatchObject({
      name: 'FiscalError',
      status: 503,
    });
  });
});

describe('fiscal client — cache', () => {
  it('a segunda consulta do mesmo CNPJ não refaz o fetch (cache 24h)', async () => {
    vi.stubEnv('FISCAL_API_URL', 'http://fiscal.local:8000');
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(json({ cnpj: '00000000000191', razao_social: 'X' }));
    vi.stubGlobal('fetch', fetchSpy);

    await consultarCnpj('00000000000191');
    await consultarCnpj('00.000.000/0001-91'); // mesma chave após normalizar
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('fiscal client — healthcheck', () => {
  it('true em 200, false quando o fetch explode', async () => {
    vi.stubEnv('FISCAL_API_URL', 'http://fiscal.local:8000');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ status: 'ok' })));
    expect(await fiscalHealthcheck()).toBe(true);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await fiscalHealthcheck()).toBe(false);
  });
});
