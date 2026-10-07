// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { ProductTour } from '@/components/onboarding/ProductTour';
import type { TourStep } from '@/lib/onboarding/tour-steps';

const STEPS: TourStep[] = [
  { id: 'um', route: '/chat', title: 'Primeiro passo', body: 'Texto do primeiro passo do tour.' },
  { id: 'dois', route: '/chat', secao: 'Seção X', target: '[data-tour="x"]', title: 'Segundo passo', body: 'Texto do segundo passo.' },
  { id: 'tres', route: '/chat', title: 'Último passo', body: 'Texto do último passo do tour.' },
];

afterEach(cleanup);
// jsdom não toca mídia: o áudio do assistente do tour é simulado em todos os testes.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// O ProductTour é controlado (quem guarda o passo é o TourHost); aqui um
// controlador mínimo em memória faz o papel do host.
function Controlado({ onFinish, navegando = false }: { onFinish: (r: 'concluido' | 'pulado') => void; navegando?: boolean }) {
  const [index, setIndex] = useState(0);
  return (
    <ProductTour
      step={STEPS[index]!}
      index={index}
      total={STEPS.length}
      navegando={navegando}
      onNext={() => setIndex((i) => i + 1)}
      onBack={() => setIndex((i) => i - 1)}
      onFinish={onFinish}
    />
  );
}

function renderTour(onFinish = vi.fn(), navegando = false) {
  render(<Controlado onFinish={onFinish} navegando={navegando} />);
  return onFinish;
}

describe('ProductTour', () => {
  it('abre no primeiro passo, sem botão de voltar', () => {
    renderTour();
    expect(screen.getByText('Primeiro passo')).toBeTruthy();
    expect(screen.getByText(/passo 1 de 3/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull();
  });

  it('avança, volta e conclui', async () => {
    const onFinish = renderTour();

    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    // Passo com alvo: o tour procura o elemento antes de mostrar o texto.
    expect(await screen.findByText('Texto do segundo passo.', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText(/Seção X · Passo 2 de 3/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByText('Primeiro passo')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await screen.findByText('Texto do segundo passo.', {}, { timeout: 4000 });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByText('Último passo')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /começar a usar/i }));
    expect(onFinish).toHaveBeenCalledWith('concluido');
  }, 15_000);

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

  it('passo com alvo ausente não trava o tour: depois da espera, mostra o cartão centrado', async () => {
    renderTour();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByText(/Abrindo a tela/)).toBeTruthy();
    expect(await screen.findByText('Texto do segundo passo.', {}, { timeout: 4000 })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Próximo' }) as HTMLButtonElement).disabled).toBe(false);
  }, 10_000);

  it('enquanto a tela do passo abre, não deixa avançar', () => {
    renderTour(vi.fn(), true);
    expect(screen.getByText(/Abrindo a tela/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Próximo' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ProductTour — assistente de voz', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); window.localStorage.clear(); });

  it('lê o passo em voz alta ao abrir, com o áudio daquele passo', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    renderTour();
    expect(screen.getByText('Assistente PROGPT')).toBeTruthy();
    await Promise.resolve();
    expect(play).toHaveBeenCalled();
    const audio = play.mock.instances[0] as unknown as HTMLAudioElement;
    expect(audio.src).toMatch(/\/tour\/voz\/um\.mp3\?v=[0-9a-f]{8}$/);
  });

  it('desligar a voz para de falar e fica lembrado', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    renderTour();
    fireEvent.click(screen.getByRole('button', { name: 'Desligar a voz do tour' }));
    expect(pause).toHaveBeenCalled();
    expect(window.localStorage.getItem('progpt_tour_voz_v1')).toBe('0');
    expect(screen.getByText('Voz desligada')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ligar a voz do tour' })).toBeTruthy();
  });

  it('com o som bloqueado pelo navegador, pede um toque no play', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('NotAllowedError'));
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    renderTour();
    expect(await screen.findByText('Toque no play para ouvir a explicação')).toBeTruthy();
  });
});
