import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isGovDataEnabled,
  govBaseUrl,
  govGet,
  govHealthcheck,
  GovDataError,
} from '@/lib/govdata/client';
import {
  cached,
  clearGovDataCache,
  clearGovDataCacheByPrefix,
} from '@/lib/govdata/cache';

// Fase 0 — cliente das APIs públicas de compras (PNCP/Compras/BACEN). Mesmo
// padrão dos testes de lib/fiscal/client: stub global fetch + stubEnv (o cliente
// lê process.env preguiçosamente). Cache limpo entre testes.

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  clearGovDataCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('govdata client — config / kill-switch', () => {
  it('isGovDataEnabled é true por padrão; só desliga com GOVDATA_ENABLED=false', () => {
    vi.stubEnv('GOVDATA_ENABLED', '');
    expect(isGovDataEnabled()).toBe(true);
    vi.stubEnv('GOVDATA_ENABLED', 'true');
    expect(isGovDataEnabled()).toBe(true);
    vi.stubEnv('GOVDATA_ENABLED', 'false');
    expect(isGovDataEnabled()).toBe(false);
    vi.stubEnv('GOVDATA_ENABLED', 'FALSE');
    expect(isGovDataEnabled()).toBe(false);
  });

  it('govGet lança GovDataError(status 0) e NÃO chama fetch quando desligado', async () => {
    vi.stubEnv('GOVDATA_ENABLED', 'false');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(govGet('bacen', '/serie/bcdata.sgs.432/dados')).rejects.toMatchObject({
      name: 'GovDataError',
      status: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('govdata client — base URLs', () => {
  it('usa os defaults públicos por base', () => {
    expect(govBaseUrl('pncp')).toBe('https://pncp.gov.br/api/consulta');
    expect(govBaseUrl('compras')).toBe('https://dadosabertos.compras.gov.br');
    expect(govBaseUrl('bacen')).toBe('https://api.bcb.gov.br/dados');
  });

  it('override por env, tolera sem esquema e remove barra final', () => {
    vi.stubEnv('PNCP_API_URL', 'pncp-proxy.local/');
    expect(govBaseUrl('pncp')).toBe('https://pncp-proxy.local');
    vi.stubEnv('BACEN_API_URL', 'http://localhost:9000/');
    expect(govBaseUrl('bacen')).toBe('http://localhost:9000');
  });
});

describe('govdata client — GET + params', () => {
  it('monta a URL com base + path + params, pulando undefined/null/empty', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(json({ resultado: [], totalRegistros: 0 }));
    vi.stubGlobal('fetch', fetchSpy);
    await govGet('compras', '/modulo-pesquisa-preco/1_consultarMaterial', {
      codigoItemCatalogo: 341842,
      estado: undefined,
      municipio: '',
      pagina: 1,
      tamanhoPagina: 10,
    });
    const [url] = fetchSpy.mock.calls[0]! as [string];
    expect(url).toContain(
      'https://dadosabertos.compras.gov.br/modulo-pesquisa-preco/1_consultarMaterial?',
    );
    expect(url).toContain('codigoItemCatalogo=341842');
    expect(url).toContain('pagina=1');
    expect(url).toContain('tamanhoPagina=10');
    expect(url).not.toContain('estado');
    expect(url).not.toContain('municipio');
  });

  it('aceita resposta em array (BACEN SGS)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(json([{ data: '05/08/2026', valor: '14.25' }]));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await govGet<Array<{ valor: string }>>(
      'bacen',
      '/serie/bcdata.sgs.432/dados/ultimos/1',
      { formato: 'json' },
    );
    expect(r[0]!.valor).toBe('14.25');
  });
});

describe('govdata client — retry / fail-soft', () => {
  it('5xx persistente vira GovDataError após 1 retry (2 fetches)', async () => {
    const fetchSpy = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('err', { status: 502 })));
    vi.stubGlobal('fetch', fetchSpy);
    await expect(govGet('pncp', '/v1/atas')).rejects.toMatchObject({ status: 502 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('5xx na 1ª → retry → sucesso na 2ª', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('cold', { status: 503 }))
      .mockResolvedValueOnce(json({ data: [], totalRegistros: 0 }));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await govGet('pncp', '/v1/atas');
    expect(r).toEqual({ data: [], totalRegistros: 0 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('4xx NÃO faz retry', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('bad', { status: 400 }));
    vi.stubGlobal('fetch', fetchSpy);
    await expect(govGet('pncp', '/v1/atas', { tamanhoPagina: 2 })).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('govdata client — healthcheck', () => {
  it('true em 200, false quando o fetch explode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([])));
    expect(await govHealthcheck('bacen', '/serie/bcdata.sgs.432/dados/ultimos/1')).toBe(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await govHealthcheck('bacen', '/x')).toBe(false);
  });
});

describe('govdata cache', () => {
  it('segunda chamada da mesma chave não refaz o fetcher (TTL)', async () => {
    let calls = 0;
    const f = () => {
      calls++;
      return Promise.resolve(calls);
    };
    await cached('k', f);
    await cached('k', f);
    expect(calls).toBe(1);
  });

  it('expira após o TTL', async () => {
    let calls = 0;
    const f = () => {
      calls++;
      return Promise.resolve(calls);
    };
    await cached('k', f, 1000, 0);
    await cached('k', f, 1000, 2000); // depois do TTL
    expect(calls).toBe(2);
  });

  it('clearGovDataCacheByPrefix invalida só as chaves com o prefixo', async () => {
    let bacen = 0;
    let outro = 0;
    const fb = () => Promise.resolve(++bacen);
    const fo = () => Promise.resolve(++outro);
    await cached('bacen-range:1:24', fb);
    await cached('catmat:classes', fo);
    clearGovDataCacheByPrefix('bacen');
    await cached('bacen-range:1:24', fb); // re-busca (invalidado)
    await cached('catmat:classes', fo); // ainda cacheado
    expect(bacen).toBe(2);
    expect(outro).toBe(1);
  });
});
