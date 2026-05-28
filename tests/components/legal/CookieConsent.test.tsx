// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CookieConsent } from '@/components/legal/CookieConsent';

const STORAGE_KEY = 'procurementgpt_cookie_consent_v1';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('CookieConsent', () => {
  it('renders on first visit (no localStorage key)', () => {
    render(<CookieConsent />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/cookies essenciais/i)).toBeTruthy();
  });

  it('does NOT render when consent already saved', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice: 'all' }));
    render(<CookieConsent />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking "Aceitar tudo" persists choice and hides banner', () => {
    render(<CookieConsent />);
    fireEvent.click(screen.getByRole('button', { name: /aceitar tudo/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.choice).toBe('all');
    expect(saved.at).toBeTruthy();
  });

  it('clicking "Apenas essenciais" persists choice and hides banner', () => {
    render(<CookieConsent />);
    fireEvent.click(screen.getByRole('button', { name: /apenas essenciais/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.choice).toBe('essential-only');
  });
});
