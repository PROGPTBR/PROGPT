import { describe, expect, it } from 'vitest';
import { looksLikeRefusal } from '@/components/chat/refusal-cta';

describe('looksLikeRefusal', () => {
  it('matches the canonical refusal phrasing', () => {
    expect(looksLikeRefusal('Não tenho fonte sobre isso na minha base.')).toBe(true);
    expect(
      looksLikeRefusal(
        'Não tenho fonte na minha base para consultar resultado de jogo em tempo real ou de ontem.',
      ),
    ).toBe(true);
  });

  it('matches close variants mentioned in the system prompt', () => {
    expect(looksLikeRefusal('Sem fonte sobre isso na base atual.')).toBe(true);
    expect(looksLikeRefusal('Não tenho essa informação na minha base.')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(looksLikeRefusal('NÃO TENHO FONTE SOBRE ISSO.')).toBe(true);
  });

  it('does not match a normal, grounded answer', () => {
    expect(
      looksLikeRefusal('A matriz de Kraljic foi publicada por Peter Kraljic na HBR em 1983.'),
    ).toBe(false);
  });

  it('does not false-positive on unrelated mentions of "fonte" or "informação"', () => {
    expect(looksLikeRefusal('A fonte primária desse framework é Michael Porter.')).toBe(false);
    expect(looksLikeRefusal('Essa informação está disponível no artigo X.')).toBe(false);
  });
});
