// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  detectAssistantToolCTA,
  stripAssistantPaths,
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

  it('returns porter/abc/financial/scorecard/profile/negotiation', () => {
    expect(detectAssistantToolCTA('vá pra /assistants/porter')).toBe('porter');
    expect(detectAssistantToolCTA('use /assistants/abc')).toBe('abc');
    expect(detectAssistantToolCTA('/assistants/financial é a tool')).toBe('financial');
    expect(detectAssistantToolCTA('use /assistants/scorecard')).toBe('scorecard');
    expect(detectAssistantToolCTA('/assistants/profile')).toBe('profile');
    expect(detectAssistantToolCTA('/assistants/negotiation')).toBe('negotiation');
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

describe('stripAssistantPaths', () => {
  it('removes "em /assistants/<type>" leaving natural text (the card carries the CTA)', () => {
    expect(
      stripAssistantPaths('use a ferramenta dedicada em /assistants/rfp — ela gera'),
    ).toBe('use a ferramenta dedicada — ela gera');
  });

  it('removes a bare path and tidies the extra space', () => {
    expect(stripAssistantPaths('acesse /assistants/kraljic e siga')).toBe(
      'acesse e siga',
    );
  });

  it('removes the path before a period without leaving a gap', () => {
    expect(stripAssistantPaths('use a ferramenta em /assistants/rfp.')).toBe(
      'use a ferramenta.',
    );
  });

  it('strips suppliers too (so the raw path never shows in the text)', () => {
    expect(stripAssistantPaths('busque em /assistants/suppliers hoje')).toBe(
      'busque hoje',
    );
  });

  it('strips the scorecard path', () => {
    expect(stripAssistantPaths('monte em /assistants/scorecard hoje')).toBe(
      'monte hoje',
    );
  });

  it('leaves unknown/invalid paths untouched', () => {
    expect(stripAssistantPaths('/assistants/foobar fica')).toBe(
      '/assistants/foobar fica',
    );
    expect(stripAssistantPaths('/assistants/rfq fica')).toBe('/assistants/rfq fica');
  });

  it('returns the input unchanged when there is no path', () => {
    expect(stripAssistantPaths('sem ferramenta aqui')).toBe('sem ferramenta aqui');
  });
});
