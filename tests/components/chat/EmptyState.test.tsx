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

  it('does NOT render the Perfil da Categoria link (removed from chat — confundia usuários)', () => {
    renderState();
    expect(screen.queryByRole('link', { name: /Perfil da Categoria/i })).toBeNull();
  });

  it('renders the assistant launcher with the 7 assistants (Perfil removido do chat)', () => {
    renderState();
    // Launcher chips são <a> com href pra /assistants/*
    const launcherNav = screen.getByRole('navigation', {
      name: /atalhos para assistentes/i,
    });
    expect(launcherNav).toBeTruthy();
    for (const slug of [
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
    // Perfil foi removido do chat (continua no hub /assistants)
    expect(launcherNav.querySelector('a[href="/assistants/profile"]')).toBeNull();
  });
});
