// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TributarioAssistant } from '@/components/assistants/TributarioAssistant';
import { PREFILL_TRIBUTARIO_KEY } from '@/lib/tributario/prefill';

afterEach(() => cleanup());

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/templates')) return new Response(JSON.stringify({ templates: [{ id: 't1', name: 'T' }] }));
      if (String(url).includes('/extrair'))
        return new Response(JSON.stringify({ propostas: [] }), { status: 200 });
      return new Response('{}');
    }),
  );
});

describe('TributarioAssistant para quem não é da área tributária', () => {
  it('mostra nomes simples e explica o termo no "?"', async () => {
    render(<TributarioAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'Carregar exemplo' }));
    expect(screen.getAllByText(/ICMS \(imposto estadual\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Custo real da compra/).length).toBeGreaterThan(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'O que é ICMS?' })[0]!);
    expect(screen.getByRole('note').textContent).toMatch(/Imposto estadual sobre a mercadoria/);
  });

  it('propostas vindas do Equalizador já começam a ser lidas', async () => {
    sessionStorage.setItem(
      PREFILL_TRIBUTARIO_KEY,
      JSON.stringify({ texto: 'Fornecedor A: 100 paletes a R$ 95, ICMS 12%, frete 1.200', descricao: 'Paletes' }),
    );
    render(<TributarioAssistant />);
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]).includes('/extrair'))).toBe(true),
    );
    expect(sessionStorage.getItem(PREFILL_TRIBUTARIO_KEY)).toBeNull();
    expect((screen.getByPlaceholderText(/Ex.: chapas de aço/) as HTMLInputElement).value).toBe('Paletes');
  });
});
