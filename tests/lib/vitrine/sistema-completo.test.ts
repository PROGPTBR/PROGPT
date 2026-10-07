import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { podeVerSistemaCompleto, SISTEMAS_COMPLETOS } from '@/lib/vitrine/sistema-completo';

describe('sistema completo de demonstração', () => {
  it('libera só quem está na lista, sem diferença de caixa', () => {
    expect(podeVerSistemaCompleto('Alexandre@B2Supply.com')).toBe(true);
    expect(podeVerSistemaCompleto('outro@b2supply.com')).toBe(false);
    expect(podeVerSistemaCompleto(null)).toBe(false);
    expect(podeVerSistemaCompleto('')).toBe(false);
  });

  it('cada sistema aponta para uma build publicada em public/demos', () => {
    for (const { src } of Object.values(SISTEMAS_COMPLETOS)) {
      const pasta = src.split('/').slice(0, 3).join('/'); // /demos/<app>
      expect(existsSync(`public${pasta}/index.html`)).toBe(true);
    }
  });
});
