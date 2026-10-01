import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TOUR_STEPS, placeCard } from '@/lib/onboarding/tour-steps';

const VIEWPORT = { width: 1280, height: 800 };
const CARD = { width: 360, height: 220 };

describe('TOUR_STEPS', () => {
  it('não repete id (o id identifica o passo no progresso)', () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('abre e fecha com passo sem alvo, para o tour não começar preso a um elemento', () => {
    expect(TOUR_STEPS[0]?.target).toBeUndefined();
    expect(TOUR_STEPS[TOUR_STEPS.length - 1]?.target).toBeUndefined();
  });

  it('todo passo tem título e texto em português', () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(3);
      expect(step.body.trim().length).toBeGreaterThan(20);
    }
  });

  // Este é o teste que importa de verdade: um passo que aponta para um
  // elemento que alguém renomeou vira um cartão centrado silencioso — o tour
  // continua funcionando e ninguém percebe que o destaque sumiu.
  it('todo seletor de passo existe em algum componente', () => {
    const root = join(__dirname, '..', '..', '..');
    const sources = [
      'components/chat/Sidebar.tsx',
      'components/chat/Composer.tsx',
      'components/chat/AssistantLauncher.tsx',
      'components/auth/UserRow.tsx',
    ]
      .map((f) => readFileSync(join(root, f), 'utf8'))
      .join('\n');

    for (const step of TOUR_STEPS) {
      if (!step.target) continue;

      const dataTour = /^\[data-tour="([^"]+)"\]$/.exec(step.target);
      if (dataTour) {
        const value = dataTour[1];
        // Os itens de navegação montam o atributo a partir do href.
        const navHref = /^nav-(.+)$/.exec(value);
        const needle = navHref
          ? `href: '/${navHref[1]}'`
          : `data-tour="${value}"`;
        expect(sources, `passo "${step.id}" aponta para ${step.target}`).toContain(needle);
        continue;
      }

      const aria = /^\[aria-label="([^"]+)"\]$/.exec(step.target);
      expect(aria, `seletor não reconhecido no passo "${step.id}"`).not.toBeNull();
      expect(sources, `passo "${step.id}" aponta para ${step.target}`).toContain(
        `aria-label="${aria![1]}"`,
      );
    }
  });
});

describe('placeCard', () => {
  it('centraliza quando não há alvo', () => {
    expect(placeCard(null, VIEWPORT, CARD)).toEqual({ top: 290, left: 460 });
  });

  it('encosta à direita do alvo quando cabe', () => {
    const rect = { top: 100, left: 0, width: 260, height: 40 };
    expect(placeCard(rect, VIEWPORT, CARD)).toEqual({ top: 100, left: 274 });
  });

  it('cai para baixo do alvo quando não cabe à direita', () => {
    const rect = { top: 80, left: 1000, width: 260, height: 40 };
    const pos = placeCard(rect, VIEWPORT, CARD);
    expect(pos.top).toBe(134);
    expect(pos.left).toBe(904); // preso à margem direita da janela
  });

  it('sobe acima do alvo quando não cabe à direita nem abaixo', () => {
    const rect = { top: 600, left: 1000, width: 260, height: 180 };
    expect(placeCard(rect, VIEWPORT, CARD).top).toBe(366);
  });

  it('nunca sai da janela, mesmo com alvo colado na borda', () => {
    const rect = { top: 0, left: 1270, width: 10, height: 10 };
    const pos = placeCard(rect, VIEWPORT, CARD);
    expect(pos.left).toBeGreaterThanOrEqual(16);
    expect(pos.top).toBeGreaterThanOrEqual(16);
    expect(pos.left + CARD.width).toBeLessThanOrEqual(VIEWPORT.width - 16);
    expect(pos.top + CARD.height).toBeLessThanOrEqual(VIEWPORT.height - 16);
  });

  it('centraliza quando a janela é menor que o cartão', () => {
    const tiny = { width: 320, height: 200 };
    const pos = placeCard({ top: 10, left: 10, width: 50, height: 50 }, tiny, CARD);
    expect(pos).toEqual({ top: 16, left: 16 });
  });
});
