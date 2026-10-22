// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/assistants/suppliers',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/components/assistants/SuppliersAssistant', () => ({
  SuppliersAssistant: () => <div>busca-de-item</div>,
}));
vi.mock('@/components/assistants/mapa/MapaFornecedoresAssistant', () => ({
  MapaFornecedoresAssistant: () => <div>mapa-da-operacao</div>,
}));

import { FornecedoresUnificado } from '@/components/assistants/FornecedoresUnificado';
import { TOUR_ABA_EVENT } from '@/lib/onboarding/tour-state';

afterEach(() => {
  cleanup();
  replace.mockReset();
});

// Pedido do Alexandre (21/10/2026): Busca e Mapa na mesma tela, e o cliente
// escolhe o tipo de busca antes de aparecer o campo.
describe('FornecedoresUnificado', () => {
  it('pergunta o que o cliente quer encontrar antes de mostrar o campo', () => {
    render(<FornecedoresUnificado tipoInicial={null} mapaLiberado buscaAmpliada />);
    expect(screen.getByText('O que você quer encontrar?')).toBeTruthy();
    expect(screen.getByText('Um item ou serviço')).toBeTruthy();
    expect(screen.getByText('Todos os fornecedores da minha operação')).toBeTruthy();
    expect(screen.getByText('Na minha base de fornecedores')).toBeTruthy();
    expect(screen.queryByText('busca-de-item')).toBeNull();
  });

  it('escolher abre o modo certo e guarda o tipo na URL', () => {
    render(<FornecedoresUnificado tipoInicial={null} mapaLiberado buscaAmpliada />);
    fireEvent.click(screen.getByText('Todos os fornecedores da minha operação'));
    expect(screen.getByText('mapa-da-operacao')).toBeTruthy();
    expect(replace).toHaveBeenCalledWith('/assistants/suppliers?tipo=operacao', { scroll: false });
  });

  it('esconde o Mapa quando o módulo está desligado para a empresa', () => {
    render(<FornecedoresUnificado tipoInicial="operacao" mapaLiberado={false} buscaAmpliada />);
    expect(screen.getByText('busca-de-item')).toBeTruthy();
    expect(screen.queryByText('Todos os fornecedores da minha operação')).toBeNull();
  });

  it('o tour abre o modo de item sozinho', () => {
    render(<FornecedoresUnificado tipoInicial={null} mapaLiberado buscaAmpliada />);
    act(() => {
      window.dispatchEvent(new CustomEvent(TOUR_ABA_EVENT, { detail: 'item' }));
    });
    expect(screen.getByText('busca-de-item')).toBeTruthy();
  });
});
