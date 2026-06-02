// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  detectAssistantToolCTA,
  linkifyAssistantPaths,
} from '@/components/chat/AssistantToolCTA';

describe('detectAssistantToolCTA', () => {
  it('returns rfp when text mentions /assistants/rfp', () => {
    expect(
      detectAssistantToolCTA('Use a ferramenta dedicada em /assistants/rfp.'),
    ).toBe('rfp');
  });

  it('returns kraljic when text mentions /assistants/kraljic', () => {
    expect(
      detectAssistantToolCTA(
        'Para a matriz de Kraljic, acesse /assistants/kraljic e siga o form.',
      ),
    ).toBe('kraljic');
  });

  it('returns porter/abc/financial/profile', () => {
    expect(detectAssistantToolCTA('vá pra /assistants/porter')).toBe('porter');
    expect(detectAssistantToolCTA('use /assistants/abc')).toBe('abc');
    expect(detectAssistantToolCTA('/assistants/financial é a tool')).toBe('financial');
    expect(detectAssistantToolCTA('/assistants/profile')).toBe('profile');
  });

  it('returns null for suppliers (handled by supplier_search intent CTA)', () => {
    expect(
      detectAssistantToolCTA('Use /assistants/suppliers pra buscar.'),
    ).toBeNull();
  });

  it('returns null for unknown types', () => {
    expect(detectAssistantToolCTA('/assistants/rfq is not real')).toBeNull();
    expect(detectAssistantToolCTA('/assistants/cotacao does not exist')).toBeNull();
    expect(detectAssistantToolCTA('/assistants/foobar')).toBeNull();
  });

  it('returns null when text has no assistant path', () => {
    expect(detectAssistantToolCTA('teoria pura sem ferramenta dedicada')).toBeNull();
    expect(detectAssistantToolCTA('')).toBeNull();
  });

  it('returns the FIRST mention when multiple present', () => {
    expect(
      detectAssistantToolCTA(
        'Você pode usar /assistants/rfp ou /assistants/kraljic.',
      ),
    ).toBe('rfp');
  });

  it('case-insensitive match', () => {
    expect(detectAssistantToolCTA('/Assistants/RFP')).toBe('rfp');
  });
});

describe('linkifyAssistantPaths', () => {
  it('turns a bare canonical path into a markdown link', () => {
    expect(linkifyAssistantPaths('use a ferramenta em /assistants/rfp agora')).toBe(
      'use a ferramenta em [/assistants/rfp](/assistants/rfp) agora',
    );
  });

  it('linkifies suppliers too (valid route, unlike the card)', () => {
    expect(linkifyAssistantPaths('busque em /assistants/suppliers')).toBe(
      'busque em [/assistants/suppliers](/assistants/suppliers)',
    );
  });

  it('does not double-link an existing markdown link', () => {
    const s = '[abrir](/assistants/rfp)';
    expect(linkifyAssistantPaths(s)).toBe(s);
  });

  it('ignores a path inside inline code', () => {
    const s = '`/assistants/rfp`';
    expect(linkifyAssistantPaths(s)).toBe(s);
  });

  it('leaves unknown/invalid paths untouched', () => {
    expect(linkifyAssistantPaths('/assistants/foobar')).toBe('/assistants/foobar');
    expect(linkifyAssistantPaths('/assistants/rfq')).toBe('/assistants/rfq');
  });

  it('handles multiple distinct occurrences', () => {
    expect(
      linkifyAssistantPaths('veja /assistants/rfp e /assistants/kraljic'),
    ).toBe(
      'veja [/assistants/rfp](/assistants/rfp) e [/assistants/kraljic](/assistants/kraljic)',
    );
  });

  it('returns the input unchanged when there is no path', () => {
    expect(linkifyAssistantPaths('sem ferramenta aqui')).toBe('sem ferramenta aqui');
  });
});
