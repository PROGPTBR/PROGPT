import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODULOS, lerDesativados, moduloDoCaminho, moduloDoHref } from '@/lib/modulos/catalogo';
import { ASSISTANTS } from '@/components/assistants/assistants-data';

describe('catálogo de módulos', () => {
  it('ids únicos', () => {
    expect(new Set(MODULOS.map((m) => m.id)).size).toBe(MODULOS.length);
  });

  it('acha o módulo pela tela, respeitando a fronteira do caminho', () => {
    expect(moduloDoCaminho('/assistants/kraljic')).toBe('kraljic');
    expect(moduloDoCaminho('/assistants/kraljic/abc')).toBe('kraljic');
    expect(moduloDoCaminho('/simulador')).toBe('simulador_tributario');
    expect(moduloDoCaminho('/simulador-logistico')).toBe('simulador_logistico');
    expect(moduloDoCaminho('/fluxo/123')).toBe('fluxo_compras');
    expect(moduloDoCaminho('/assistants')).toBeNull();
    expect(moduloDoCaminho('/assistants/history')).toBeNull();
    expect(moduloDoCaminho('/chat')).toBeNull();
    expect(moduloDoHref('/prompts?x=1')).toBe('prompts');
  });

  it('todo card do hub (menos o Painel, que é visão geral) tem módulo', () => {
    const semModulo = ASSISTANTS.filter((a) => a.id !== 'painel' && !moduloDoHref(a.href)).map((a) => a.id);
    expect(semModulo).toEqual([]);
  });

  it('todo módulo aponta para uma tela que existe', () => {
    for (const m of MODULOS) {
      for (const c of m.caminhos) {
        expect(() => readFileSync(`app${c}/page.tsx`), `${m.id}: app${c}/page.tsx`).not.toThrow();
      }
    }
  });

  it('todo caminho de módulo passa pelo middleware', () => {
    const mw = readFileSync('middleware.ts', 'utf8');
    for (const m of MODULOS) {
      for (const c of m.caminhos) {
        const raiz = `/${c.split('/')[1]}`;
        expect(mw, `${m.id} (${raiz})`).toContain(`'${raiz}/:path*'`);
      }
    }
  });

  it('lê a lista de desligados ignorando lixo e repetição', () => {
    expect(lerDesativados(null)).toEqual([]);
    expect(lerDesativados({})).toEqual([]);
    expect(lerDesativados({ modulos_desativados: 'kraljic' })).toEqual([]);
    expect(lerDesativados({ modulos_desativados: ['kraljic', 'kraljic', 'inexistente', 3] })).toEqual(['kraljic']);
  });
});
