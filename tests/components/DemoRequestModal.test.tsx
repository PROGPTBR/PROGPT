// @vitest-environment jsdom

import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoRequestModal } from '@/components/marketing/DemoRequestModal';

function Harness() {
  const [open, setOpen] = useState(false);
  const [solution, setSolution] = useState('Demonstração do PROGPT');
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);

  function show(nextSolution: string, element: HTMLButtonElement) {
    setSolution(nextSolution);
    setTrigger(element);
    setOpen(true);
  }

  return (
    <>
      <button onClick={(event) => show('Dashboard', event.currentTarget)}>Demo Dashboard</button>
      <button onClick={(event) => show('RFI/RFQ', event.currentTarget)}>Demo RFI/RFQ</button>
      <DemoRequestModal
        open={open}
        solution={solution}
        onOpenChange={setOpen}
        returnFocusElement={trigger}
      />
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DemoRequestModal', () => {
  it('atualiza a solução, fecha com Escape e devolve o foco', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const dashboardTrigger = screen.getByRole('button', { name: 'Demo Dashboard' });
    await user.click(dashboardTrigger);
    expect(screen.getByRole('dialog').textContent).toContain('Dashboard');
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(dashboardTrigger);

    await user.click(screen.getByRole('button', { name: 'Demo RFI/RFQ' }));
    expect(screen.getByRole('dialog').textContent).toContain('RFI/RFQ');
  });

  it('preserva os campos e não mostra sucesso quando o servidor falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Canal de envio indisponível.' }),
      }),
    );
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Demo Dashboard' }));

    await user.type(screen.getByLabelText(/Nome completo/), 'Maria Compradora');
    await user.type(screen.getByLabelText(/E-mail profissional/), 'maria@empresa.com.br');
    await user.type(screen.getByLabelText(/WhatsApp/), '(21) 99999-9999');
    await user.type(screen.getByLabelText(/Empresa/), 'Empresa Exemplo');
    const submit = screen.getByRole('button', { name: 'Solicitar demonstração' });
    fireEvent.submit(submit.closest('form')!);

    expect((await screen.findByRole('alert')).textContent).toContain('Canal de envio indisponível.');
    expect((screen.getByLabelText(/Nome completo/) as HTMLInputElement).value).toBe('Maria Compradora');
    expect(screen.queryByText('Solicitação recebida!')).toBeNull();
  });
});

