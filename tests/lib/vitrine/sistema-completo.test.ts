import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { podeVerSistemaCompleto, SISTEMAS_COMPLETOS, SISTEMAS_DE_OBRAS } from '@/lib/vitrine/sistema-completo';

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

  it('a aba Gestão de Obras oferece os dois sistemas de obras', () => {
    expect(SISTEMAS_DE_OBRAS).toEqual(['obras', 'obrasmateriais']);
    expect(SISTEMAS_COMPLETOS.obrasmateriais.titulo).toBe('Obras & Materiais PROGPT');
  });

  it('a demonstração do Obras & Materiais não leva nome, e-mail nem endereço reais', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const pasta = 'public/demos/obrasmateriais/assets';
    const js = readdirSync(pasta).filter((f) => f.endsWith('.js')).map((f) => readFileSync(`${pasta}/${f}`, 'utf8')).join('\n');
    for (const proibido of ['grupoconexao', 'conexao.com', 'JOCSÃ', 'Vida Nova', 'JL Village', 'conectacrm.vercel.app', 'supabase.co']) {
      expect(js.includes(proibido), proibido).toBe(false);
    }
  });
});
