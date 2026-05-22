// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { detectAssistantToolCTA } from '@/components/chat/AssistantToolCTA';

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
