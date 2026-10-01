// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { ProductTour } from '@/components/onboarding/ProductTour';
import type { TourStep } from '@/lib/onboarding/tour-steps';

const STEPS: TourStep[] = [
  { id: 'um', title: 'Primeiro passo', body: 'Texto do primeiro passo do tour.' },
  { id: 'dois', target: '[data-tour="x"]', title: 'Segundo passo', body: 'Texto do segundo passo.' },
  { id: 'tres', title: 'Último passo', body: 'Texto do último passo do tour.' },
];

afterEach(cleanup);

function renderTour(onFinish = vi.fn()) {
  render(<ProductTour open onFinish={onFinish} steps={STEPS} />);
  return onFinish;
}

describe('ProductTour', () => {
  it('não renderiza nada fechado', () => {
    const { container } = render(
      <ProductTour open={false} onFinish={vi.fn()} steps={STEPS} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('abre no primeiro passo, sem botão de voltar', () => {
    renderTour();
    expect(screen.getByText('Primeiro passo')).toBeTruthy();
    expect(screen.getByText(/passo 1 de 3/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull();
  });

  it('avança, volta e conclui', () => {
    const onFinish = renderTour();

    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByText('Segundo passo')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByText('Primeiro passo')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByText('Último passo')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /começar a usar/i }));
    expect(onFinish).toHaveBeenCalledWith('concluido');
  });

  // Pular é tão definitivo quanto concluir: nos dois casos o cliente decidiu,
  // e o tour não deve voltar no próximo login.
  it('pular encerra o tour para sempre', () => {
    const onFinish = renderTour();
    fireEvent.click(screen.getByRole('button', { name: /pular tour/i }));
    expect(onFinish).toHaveBeenCalledWith('pulado');
  });

  it('Esc também encerra', () => {
    const onFinish = renderTour();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onFinish).toHaveBeenCalledWith('pulado');
  });

  it('passo com alvo ausente não trava o tour', () => {
    renderTour();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    // O alvo [data-tour="x"] não existe nesta árvore: o passo segue visível.
    expect(screen.getByText('Segundo passo')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
