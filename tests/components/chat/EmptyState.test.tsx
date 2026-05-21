// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('clicking a suggestion pill calls onChange with the matching starter query', async () => {
    const { onChange } = renderState();
    const user = userEvent.setup();
    const compras = screen.getByRole('button', { name: /^Compras$/i });
    await user.click(compras);
    expect(onChange).toHaveBeenCalledWith(
      'Como definir a estratégia de compras para uma categoria nova?',
    );
  });

  it('shows the "Descobrir temas" pill with the library-overview query (sub-projeto 18)', async () => {
    const { onChange } = renderState();
    const card = screen.getByRole('button', { name: /Descobrir/i });
    expect(card).toBeTruthy();
    const user = userEvent.setup();
    await user.click(card);
    expect(onChange).toHaveBeenCalledWith('Sobre o que você pode me ensinar?');
  });

  it('renders the action-oriented hero pitch', () => {
    renderState();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(/IA de Suprimentos.*Qual problema/i);
  });

  it('exposes all five procurement areas as pills', () => {
    renderState();
    for (const area of ['Compras', 'Contratos', 'Fornecedores', 'Estoque', 'Logística']) {
      expect(
        screen.getByRole('button', { name: new RegExp(`^${area}$`, 'i') }),
      ).toBeTruthy();
    }
  });

  it('renders the Perfil da Categoria link', () => {
    renderState();
    const link = screen.getByRole('link', { name: /Perfil da Categoria/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/assistants/profile');
  });
});
