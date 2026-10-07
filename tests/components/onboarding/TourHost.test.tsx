// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const nav = vi.hoisted(() => ({ pathname: '/chat', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
}));

import { TourHost } from '@/components/onboarding/TourHost';
import { TOUR_STEPS } from '@/lib/onboarding/tour-steps';
import { readTourState, startTour, writeTourState } from '@/lib/onboarding/tour-state';

const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

beforeEach(() => {
  window.sessionStorage.clear();
  nav.pathname = '/chat';
  nav.push.mockReset();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  // jsdom não toca mídia: o áudio do assistente do tour é simulado.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const indiceDe = (id: string) => TOUR_STEPS.findIndex((s) => s.id === id);

describe('TourHost', () => {
  it('não mostra nada sem tour ativo', () => {
    render(<TourHost />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mostra o passo quando já está na tela dele', async () => {
    render(<TourHost />);
    act(() => startTour());
    expect(await screen.findByText('Bem-vindo ao PROGPT')).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('navega até a tela do passo e mostra "Abrindo a tela…" enquanto isso', async () => {
    render(<TourHost />);
    act(() => writeTourState({ index: indiceDe('assistentes-grade') }));
    expect(await screen.findByText(/Abrindo a tela/)).toBeTruthy();
    expect(nav.push).toHaveBeenCalledWith('/assistants');
    expect(nav.push).toHaveBeenCalledTimes(1);
  });

  it('"Próximo" avança o progresso guardado', async () => {
    const user = userEvent.setup();
    render(<TourHost />);
    act(() => startTour());
    await user.click(await screen.findByRole('button', { name: 'Próximo' }));
    expect(readTourState()).toEqual({ index: 1 });
  });

  it('pular encerra o tour e marca como visto no perfil', async () => {
    const user = userEvent.setup();
    render(<TourHost />);
    act(() => startTour());
    await user.click(await screen.findByRole('button', { name: 'Pular tour' }));
    expect(readTourState()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/account/onboarding-tour', { method: 'POST' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
