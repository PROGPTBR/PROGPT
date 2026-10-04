// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SupportWidget } from '@/components/support/SupportWidget';

afterEach(cleanup);

describe('SupportWidget', () => {
  it('fica fechado até clicar, e é o alvo do passo de suporte do tour', () => {
    render(<SupportWidget />);
    const botao = screen.getByRole('button', { name: 'Suporte' });
    expect(botao.getAttribute('data-tour')).toBe('suporte');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abre o FAQ com o WhatsApp do suporte', async () => {
    const user = userEvent.setup();
    render(<SupportWidget />);
    await user.click(screen.getByRole('button', { name: 'Suporte' }));
    expect(screen.getByRole('dialog', { name: 'Suporte' })).toBeTruthy();
    expect(screen.getByText('Como cancelo a assinatura?')).toBeTruthy();
    const whats = screen.getByRole('link', { name: /Falar no WhatsApp/ });
    expect(whats.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5521999792912\?text=/);
  });

  it('a busca filtra as perguntas e avisa quando não acha nada', async () => {
    const user = userEvent.setup();
    render(<SupportWidget />);
    await user.click(screen.getByRole('button', { name: 'Suporte' }));
    const busca = screen.getByRole('textbox', { name: /Buscar/ });
    await user.type(busca, 'senha');
    expect(screen.getByText('Esqueci minha senha.')).toBeTruthy();
    expect(screen.queryByText('Como cancelo a assinatura?')).toBeNull();
    await user.clear(busca);
    await user.type(busca, 'xyzinexistente');
    expect(screen.getByText(/Nenhuma pergunta encontrada/)).toBeTruthy();
  });

  it('Esc fecha o painel', async () => {
    const user = userEvent.setup();
    render(<SupportWidget />);
    await user.click(screen.getByRole('button', { name: 'Suporte' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
