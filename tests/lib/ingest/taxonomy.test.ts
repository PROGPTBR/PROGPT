import { describe, expect, it } from 'vitest';
import { TAXONOMY, THEME_DESCRIPTIONS, isValidTheme, type Theme } from '@/lib/ingest/taxonomy';

describe('TAXONOMY', () => {
  it('has exactly 11 themes', () => {
    expect(TAXONOMY).toHaveLength(11);
  });

  it('includes the canonical procurement themes', () => {
    expect(TAXONOMY).toContain('Kraljic');
    expect(TAXONOMY).toContain('Sourcing Estratégico');
    expect(TAXONOMY).toContain('SRM');
    expect(TAXONOMY).toContain('Outros');
  });

  it('THEME_DESCRIPTIONS covers every theme', () => {
    for (const t of TAXONOMY) {
      const desc = THEME_DESCRIPTIONS[t as Theme];
      expect(desc).toBeTruthy();
      expect(desc.length).toBeGreaterThan(10);
    }
  });
});

describe('isValidTheme', () => {
  it('returns true for every TAXONOMY entry', () => {
    for (const t of TAXONOMY) {
      expect(isValidTheme(t)).toBe(true);
    }
  });

  it('returns false for unknown strings', () => {
    expect(isValidTheme('foo')).toBe(false);
    expect(isValidTheme('')).toBe(false);
    expect(isValidTheme('kraljic')).toBe(false); // case-sensitive
  });
});
