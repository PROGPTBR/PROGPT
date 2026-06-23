import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isSancoesEnabled, consultarSancoes } from '@/lib/fiscal/sancoes';
import { clearFiscalCache } from '@/lib/fiscal/cache';

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => clearFiscalCache());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('sancoes (Portal da Transparência)', () => {
  it('sem token → enabled:false, não consulta, fail-soft', async () => {
    vi.stubEnv('PORTAL_TRANSPARENCIA_TOKEN', '');
    const r = await consultarSancoes('00000000000191');
    expect(isSancoesEnabled()).toBe(false);
    expect(r.enabled).toBe(false);
    expect(r.consultado).toBe(false);
    expect(r.sancoes).toEqual([]);
  });

  it('com token e CNPJ limpo → CEIS + CNEP, manda header chave-api-dados', async () => {
    vi.stubEnv('PORTAL_TRANSPARENCIA_TOKEN', 'tok-123');
    const fetchSpy = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.includes('/ceis')
            ? json([
                {
                  sancionado: { nome: 'EMPRESA X' },
                  tipoSancao: { descricaoResumida: 'Inidoneidade' },
                  orgaoSancionador: { nome: 'CGU' },
                  dataInicioSancao: '2026-01-01',
                },
              ])
            : json([]),
        ),
      );
    vi.stubGlobal('fetch', fetchSpy);

    const r = await consultarSancoes('00.000.000/0001-91');
    expect(r.consultado).toBe(true);
    expect(r.sancoes).toHaveLength(1);
    expect(r.sancoes[0]!.fonte).toBe('CEIS');
    expect(r.sancoes[0]!.nome).toBe('EMPRESA X');
    expect(r.sancoes[0]!.tipo).toBe('Inidoneidade');
    const [url, init] = fetchSpy.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain('cnpjSancionado=00000000000191');
    expect((init.headers as Record<string, string>)['chave-api-dados']).toBe('tok-123');
  });

  it('CNPJ sem sanção → consultado:true, lista vazia', async () => {
    vi.stubEnv('PORTAL_TRANSPARENCIA_TOKEN', 'tok-123');
    // Response nova por chamada (/ceis e /cnep) — body só lê uma vez.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json([]))));
    const r = await consultarSancoes('00000000000191');
    expect(r.consultado).toBe(true);
    expect(r.sancoes).toEqual([]);
  });

  it('erro da API → fail-soft (consultado:false + error)', async () => {
    vi.stubEnv('PORTAL_TRANSPARENCIA_TOKEN', 'tok-123');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 401 })));
    const r = await consultarSancoes('00000000000191');
    expect(r.consultado).toBe(false);
    expect(r.error).toBeTruthy();
  });
});
