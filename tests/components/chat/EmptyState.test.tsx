// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/components/chat/EmptyState';

afterEach(() => {
  cleanup();
});

describe('EmptyState', () => {
  it('clicking a card calls onPick with the matching query', async () => {
    const onPick = vi.fn();
    render(<EmptyState onPick={onPick} />);
    const user = userEvent.setup();
    const definir = screen.getByRole('button', { name: /definir/i });
    await user.click(definir);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('O que é a matriz de Kraljic?');
  });

  it('shows the "Descobrir" card with the library-overview query (sub-projeto 18)', async () => {
    const onPick = vi.fn();
    render(<EmptyState onPick={onPick} />);
    const card = screen.getByRole('button', { name: /Descobrir/i });
    expect(card).toBeTruthy();
    const user = userEvent.setup();
    await user.click(card);
    expect(onPick).toHaveBeenCalledWith('Sobre o que você pode me ensinar?');
  });

  it('renders the Descobrir card BEFORE the other four suggestions in the DOM', async () => {
    const onPick = vi.fn();
    render(<EmptyState onPick={onPick} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]?.textContent).toMatch(/Descobrir/);
    // The other four cards follow
    expect(buttons[1]?.textContent).toMatch(/Definir/i);
  });
});
