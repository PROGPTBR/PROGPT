// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { EmptyState } from '@/components/chat/EmptyState';

afterEach(() => {
  cleanup();
});

function renderState(overrides?: Partial<React.ComponentProps<typeof EmptyState>>) {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const onStop = vi.fn();
  const utils = render(
    <EmptyState
      input=""
      onChange={onChange}
      onSubmit={onSubmit}
      isLoading={false}
      onStop={onStop}
      {...overrides}
    />,
  );
  return { ...utils, onChange, onSubmit };
}

describe('EmptyState', () => {
  it('renders the action-oriented hero pitch', () => {
    renderState();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(/IA de Suprimentos.*Qual problema/i);
  });

  it('renders the Perfil da Categoria link', () => {
    renderState();
    const link = screen.getByRole('link', { name: /Perfil da Categoria/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/assistants/profile');
  });

  it('renders the assistant launcher with all 8 assistants', () => {
    renderState();
    // Launcher chips são <a> com href pra /assistants/*
    const launcherNav = screen.getByRole('navigation', {
      name: /atalhos para assistentes/i,
    });
    expect(launcherNav).toBeTruthy();
    for (const slug of [
      'profile',
      'abc',
      'porter',
      'suppliers',
      'kraljic',
      'rfp',
      'negotiation',
      'financial',
    ]) {
      const link = launcherNav.querySelector(`a[href="/assistants/${slug}"]`);
      expect(link).toBeTruthy();
    }
  });
});
