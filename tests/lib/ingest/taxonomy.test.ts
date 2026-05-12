import { describe, expect, it } from 'vitest';
import {
  CANONICAL_THEMES,
  TAXONOMY,
  THEME_DESCRIPTIONS,
  isCanonicalTheme,
  isValidTheme,
  normalizeCandidateTheme,
  MAX_THEME_LENGTH,
  type Theme,
} from '@/lib/ingest/taxonomy';

describe('CANONICAL_THEMES', () => {
  it('has exactly 11 themes', () => {
    expect(CANONICAL_THEMES).toHaveLength(11);
  });

  it('includes the canonical procurement themes', () => {
    expect(CANONICAL_THEMES).toContain('Kraljic');
    expect(CANONICAL_THEMES).toContain('Sourcing Estratégico');
    expect(CANONICAL_THEMES).toContain('SRM');
    expect(CANONICAL_THEMES).toContain('Outros');
  });

  it('THEME_DESCRIPTIONS covers every canonical theme', () => {
    for (const t of CANONICAL_THEMES) {
      const desc = THEME_DESCRIPTIONS[t as Theme];
      expect(desc).toBeTruthy();
      expect(desc.length).toBeGreaterThan(10);
    }
  });
});

describe('back-compat aliases', () => {
  it('TAXONOMY === CANONICAL_THEMES', () => {
    expect(TAXONOMY).toBe(CANONICAL_THEMES);
  });

  it('isValidTheme === isCanonicalTheme', () => {
    expect(isValidTheme).toBe(isCanonicalTheme);
  });
});

describe('isCanonicalTheme', () => {
  it('returns true for every CANONICAL_THEMES entry', () => {
    for (const t of CANONICAL_THEMES) {
      expect(isCanonicalTheme(t)).toBe(true);
    }
  });

  it('returns false for non-canonical strings (candidates land here)', () => {
    expect(isCanonicalTheme('Gestão de Projetos')).toBe(false);
    expect(isCanonicalTheme('foo')).toBe(false);
    expect(isCanonicalTheme('')).toBe(false);
    expect(isCanonicalTheme('kraljic')).toBe(false); // case-sensitive
  });
});

describe('normalizeCandidateTheme', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeCandidateTheme('  Gestão de Projetos  ')).toBe('Gestão de Projetos');
  });

  it('collapses internal whitespace runs to a single space', () => {
    expect(normalizeCandidateTheme('Gestão   de    Projetos')).toBe('Gestão de Projetos');
  });

  it('strips wrapping double quotes', () => {
    expect(normalizeCandidateTheme('"Gestão de Projetos"')).toBe('Gestão de Projetos');
  });

  it('strips wrapping single quotes', () => {
    expect(normalizeCandidateTheme("'Gestão de Projetos'")).toBe('Gestão de Projetos');
  });

  it('does NOT truncate at MAX_THEME_LENGTH — callers refine instead', () => {
    const long = 'x'.repeat(MAX_THEME_LENGTH + 10);
    // Silent truncation would map two genuinely different long themes onto the
    // same 50-char prefix; rejecting at the refine layer is more honest.
    expect(normalizeCandidateTheme(long).length).toBe(MAX_THEME_LENGTH + 10);
  });

  it('returns empty string when input is only whitespace', () => {
    expect(normalizeCandidateTheme('   ')).toBe('');
  });

  it('preserves acronyms (does not lowercase)', () => {
    expect(normalizeCandidateTheme('Recursos Humanos / RH')).toBe('Recursos Humanos / RH');
  });
});
