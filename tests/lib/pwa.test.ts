// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { isStandaloneDisplay } from '@/lib/pwa';

function setDisplayMode(match: (query: string) => boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: match(query),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

function setIosStandalone(value: boolean | undefined) {
  Object.defineProperty(window.navigator, 'standalone', {
    value,
    configurable: true,
  });
}

function setReferrer(value: string) {
  Object.defineProperty(document, 'referrer', {
    value,
    configurable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setIosStandalone(undefined);
  setReferrer('');
});

describe('isStandaloneDisplay', () => {
  it('é false numa aba normal do navegador (mostra a landing)', () => {
    setDisplayMode(() => false);
    expect(isStandaloneDisplay()).toBe(false);
  });

  it('é true quando display-mode é standalone (PWA Android/iOS 16.4+)', () => {
    setDisplayMode((q) => q.includes('standalone'));
    expect(isStandaloneDisplay()).toBe(true);
  });

  it('é true em fullscreen e minimal-ui', () => {
    setDisplayMode((q) => q.includes('fullscreen'));
    expect(isStandaloneDisplay()).toBe(true);
    setDisplayMode((q) => q.includes('minimal-ui'));
    expect(isStandaloneDisplay()).toBe(true);
  });

  it('é true via navigator.standalone (Safari iOS legado)', () => {
    setDisplayMode(() => false);
    setIosStandalone(true);
    expect(isStandaloneDisplay()).toBe(true);
  });

  it('é true quando o referrer é android-app:// (TWA)', () => {
    setDisplayMode(() => false);
    setReferrer('android-app://com.progpt.twa');
    expect(isStandaloneDisplay()).toBe(true);
  });

  it('não quebra se matchMedia lançar', () => {
    vi.stubGlobal('matchMedia', () => {
      throw new Error('unsupported');
    });
    expect(isStandaloneDisplay()).toBe(false);
  });
});
