// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

import { GestaoDemandasDemo } from '@/components/vitrine/demandas/GestaoDemandasDemo';
import { GestaoObrasDemo } from '@/components/vitrine/obras/GestaoObrasDemo';

const HOJE = '2026-10-04';

beforeEach(() => toastMock.mockReset());
afterEach(cleanup);

describe('Gestão de Demandas (vitrine)', () => {
  it('abre na Visão Geral com os indicadores e o aviso de demonstração', () => {
    render(<GestaoDemandasDemo hojeIso={HOJE} />);
    expect(screen.getByRole('heading', { name: 'Gestão de Demandas' })).toBeTruthy();
    expect(screen.getByText('Total de SPs')).toBeTruthy();
    expect(screen.getByText(/dados/).textContent).toMatch(/fictícios/);
    const cta = screen.getByRole('link', { name: /Quero na minha empresa/ });
    expect(cta.getAttribute('href')).toContain('https://wa.me/5521999792912');
    expect(screen.getByText('Em atraso (4)')).toBeTruthy();
  });

  it('filtra por setor e abre o detalhe da SP', async () => {
    const user = userEvent.setup();
    render(<GestaoDemandasDemo hojeIso={HOJE} />);
    await user.click(screen.getByRole('tab', { name: 'Setores' }));
    const menu = screen.getByRole('navigation', { name: 'Setores' });
    await user.click(within(menu).getByRole('button', { name: /Tecnologia da Informação/ }));
    expect(screen.getByText('Backup do servidor de arquivos em nuvem')).toBeTruthy();
    expect(screen.queryByText('Conciliação bancária de setembro')).toBeNull();

    await user.click(screen.getByText('Backup do servidor de arquivos em nuvem'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Histórico')).toBeTruthy();
    expect(within(dialog).getByText('SP-TI-22/2026')).toBeTruthy();
  });

  it('ações que gravariam algo viram aviso de produto sob demanda (nada é gravado)', async () => {
    const user = userEvent.setup();
    render(<GestaoDemandasDemo hojeIso={HOJE} />);
    await user.click(screen.getByRole('tab', { name: 'Setores' }));
    await user.click(screen.getByRole('button', { name: 'Nova SP' }));
    expect(toastMock).toHaveBeenCalledTimes(1);
    const [titulo, opcoes] = toastMock.mock.calls[0] ?? [];
    expect(titulo).toMatch(/Abrir nova SP/);
    expect(opcoes.action.label).toBe('Falar no WhatsApp');
  });
});

describe('Gestão de Obras (vitrine)', () => {
  it('abre no cockpit com a carteira de obras', () => {
    render(<GestaoObrasDemo hojeIso={HOJE} />);
    expect(screen.getByRole('heading', { name: 'Gestão de Obras' })).toBeTruthy();
    expect(screen.getByText('Valor contratado')).toBeTruthy();
    expect(screen.getAllByText('UBS Jardim das Flores').length).toBeGreaterThan(0);
  });

  it('navega contrato → obra → planilha orçamentária', async () => {
    const user = userEvent.setup();
    render(<GestaoObrasDemo hojeIso={HOJE} />);
    await user.click(screen.getByRole('tab', { name: 'Contratos e obras' }));
    await user.click(screen.getByText('Construção de duas Unidades Básicas de Saúde'));
    await user.click(screen.getByText('UBS Vila Nova'));
    expect(screen.getByText('Planilha orçamentária')).toBeTruthy();
    expect(screen.getByText('Total da obra')).toBeTruthy();
  });

  it('mostra o boletim de medição e troca de BM', async () => {
    const user = userEvent.setup();
    render(<GestaoObrasDemo hojeIso={HOJE} />);
    await user.click(screen.getByRole('tab', { name: 'Medições' }));
    expect(screen.getByText(/Boletim de medição nº 07/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /BM 03/ }));
    expect(screen.getByText(/Boletim de medição nº 03/)).toBeTruthy();
    expect(screen.getByText('Total deste boletim')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Nova medição' }));
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it('planejamento mostra as quatro colunas do Kanban', async () => {
    const user = userEvent.setup();
    render(<GestaoObrasDemo hojeIso={HOJE} />);
    await user.click(screen.getByRole('tab', { name: 'Planejamento' }));
    for (const col of ['Planejado', 'Em execução', 'Conferência', 'Concluído']) {
      expect(screen.getAllByRole('heading', { name: col }).length).toBeGreaterThan(0);
    }
  });
});

describe('vitrines + tour guiado', () => {
  const pedirAba = (id: string) =>
    act(() => {
      window.dispatchEvent(new CustomEvent('progpt:tour-aba', { detail: id }));
    });

  it('Gestão de Obras troca de aba quando o tour pede', () => {
    render(<GestaoObrasDemo hojeIso={HOJE} />);
    pedirAba('medicoes');
    expect(screen.getByRole('tab', { name: 'Medições' }).getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-tour="obras-boletim"]')).not.toBeNull();
    pedirAba('planejamento');
    expect(document.querySelector('[data-tour="obras-kanban"]')).not.toBeNull();
  });

  it('Gestão de Demandas troca de aba e ignora aba desconhecida', () => {
    render(<GestaoDemandasDemo hojeIso={HOJE} />);
    pedirAba('fluxo');
    expect(document.querySelector('[data-tour="demandas-fluxo"]')).not.toBeNull();
    pedirAba('aba-que-nao-existe');
    expect(screen.getByRole('tab', { name: 'Quadro de fluxo' }).getAttribute('aria-selected')).toBe('true');
  });
});
