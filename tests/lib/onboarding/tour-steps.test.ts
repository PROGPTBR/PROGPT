import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TOUR_STEPS, placeCard } from '@/lib/onboarding/tour-steps';

const VIEWPORT = { width: 1280, height: 800 };
const CARD = { width: 360, height: 220 };

const ROOT = join(__dirname, '..', '..', '..');

/** Todo o código de UI (app/ + components/), para achar os alvos do tour. */
function fontesDeUi(): string {
  const arquivos: string[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) andar(caminho);
      else if (/\.tsx?$/.test(nome)) arquivos.push(caminho);
    }
  };
  andar(join(ROOT, 'app'));
  andar(join(ROOT, 'components'));
  return arquivos.map((f) => readFileSync(f, 'utf8')).join('\n');
}

describe('TOUR_STEPS', () => {
  it('não repete id (o id identifica o passo no progresso)', () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('abre e fecha no chat com passo sem alvo, para o tour não começar preso a um elemento', () => {
    const primeiro = TOUR_STEPS[0]!;
    const ultimo = TOUR_STEPS[TOUR_STEPS.length - 1]!;
    expect(primeiro.target).toBeUndefined();
    expect(ultimo.target).toBeUndefined();
    expect(primeiro.route).toBe('/chat');
    expect(ultimo.route).toBe('/chat');
  });

  it('todo passo tem título e texto em português', () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(3);
      expect(step.body.trim().length).toBeGreaterThan(20);
    }
  });

  it('toda rota do tour é uma página que existe', () => {
    for (const route of new Set(TOUR_STEPS.map((s) => s.route))) {
      expect(route.startsWith('/'), route).toBe(true);
      expect(existsSync(join(ROOT, 'app', route, 'page.tsx')), `app${route}/page.tsx`).toBe(true);
    }
  });

  // Cada troca de rota é uma navegação. Passos da mesma tela espalhados pelo
  // roteiro fariam o tour ir e voltar entre telas. Só o /chat aparece duas
  // vezes: abre o tour e o fecha.
  it('passos da mesma tela ficam juntos', () => {
    const blocos: string[] = [];
    for (const step of TOUR_STEPS) {
      if (blocos[blocos.length - 1] !== step.route) blocos.push(step.route);
    }
    const repetidas = blocos.filter((r, i) => blocos.indexOf(r) !== i);
    expect(repetidas).toEqual(['/chat']);
  });

  it('visita os módulos novos (vitrines sob demanda)', () => {
    const rotas = TOUR_STEPS.map((s) => s.route);
    expect(rotas).toContain('/gestao-obras');
    expect(rotas).toContain('/gestao-demandas');
  });

  // Este é o teste que importa de verdade: um passo que aponta para um
  // elemento que alguém renomeou vira um cartão centrado silencioso — o tour
  // continua funcionando e ninguém percebe que o destaque sumiu.
  it('todo seletor de passo existe em algum componente', () => {
    const sources = fontesDeUi();

    for (const step of TOUR_STEPS) {
      if (!step.target) continue;

      const dataTour = /^\[data-tour="([^"]+)"\]$/.exec(step.target);
      if (dataTour) {
        const value = dataTour[1] ?? '';
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
