// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  window.sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

const carregar = () => import('@/lib/onboarding/tour-state');

describe('tour-state', () => {
  it('começa sem tour', async () => {
    const t = await carregar();
    expect(t.readTourState()).toBeNull();
    expect(t.tourJaIniciado()).toBe(false);
  });

  it('startTour abre no passo 0, marca a aba e avisa os ouvintes', async () => {
    const t = await carregar();
    const ouvinte = vi.fn();
    window.addEventListener(t.TOUR_EVENT, ouvinte);
    t.startTour();
    expect(t.readTourState()).toEqual({ index: 0 });
    expect(t.tourJaIniciado()).toBe(true);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener(t.TOUR_EVENT, ouvinte);
  });

  it('o progresso sobrevive à troca de tela (fica no sessionStorage)', async () => {
    const t = await carregar();
    t.writeTourState({ index: 7 });
    vi.resetModules();
    const depois = await carregar();
    expect(depois.readTourState()).toEqual({ index: 7 });
  });

  it('encerrar limpa o progresso mas lembra que o tour já rodou nesta aba', async () => {
    const t = await carregar();
    t.startTour();
    t.clearTourState();
    expect(t.readTourState()).toBeNull();
    expect(t.tourJaIniciado()).toBe(true);
  });

  it('valor corrompido no storage é ignorado', async () => {
    const t = await carregar();
    window.sessionStorage.setItem(t.TOUR_STATE_KEY, '{lixo');
    expect(t.readTourState()).toBeNull();
    window.sessionStorage.setItem(t.TOUR_STATE_KEY, JSON.stringify({ index: -3 }));
    expect(t.readTourState()).toBeNull();
  });

  it('com o storage bloqueado, o tour segue em memória', async () => {
    const t = await carregar();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    t.startTour();
    expect(t.readTourState()).toEqual({ index: 0 });
    expect(t.tourJaIniciado()).toBe(true);
    t.clearTourState();
    expect(t.readTourState()).toBeNull();
  });
});
