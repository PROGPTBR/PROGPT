// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { pushSpy } = vi.hoisted(() => ({ pushSpy: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  pushSpy.mockReset();
  window.sessionStorage.clear();
  vi.doMock('next/navigation', () => ({ useRouter: () => ({ push: pushSpy }) }));
  vi.doMock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
  // usePromptFavorites toggle writes here; favorites hidratam do prop initial.
  vi.doMock('@/lib/db/supabase-browser', () => ({
    supabaseBrowser: () => ({
      from: () => {
        const api: Record<string, unknown> = {};
        api.select = async () => ({ data: [], error: null });
        api.insert = async () => ({ error: null });
        api.delete = () => api;
        api.eq = async () => ({ error: null });
        return api;
      },
    }),
  }));
});

afterEach(() => cleanup());

const PROMPTS = [
  { id: 'p1', prompt_number: 1, title: 'Sourcing Global', summary: 'Avalia sourcing', content: 'Conteúdo do prompt 1 com [categoria].', category: 'Sourcing', tags: ['global'] },
  { id: 'p2', prompt_number: 2, title: 'Matriz de Kraljic', summary: 'Análise 2x2', content: 'Conteúdo 2', category: 'Estratégia', tags: ['kraljic'] },
  { id: 'p3', prompt_number: 3, title: 'Negociar preço', summary: 'Táticas', content: 'Conteúdo 3', category: 'Sourcing', tags: [] },
];

async function renderLib(favorites: string[] = []) {
  const { PromptsLibrary } = await import('@/components/prompts/PromptsLibrary');
  return render(<PromptsLibrary prompts={PROMPTS} initialFavorites={favorites} />);
}

describe('PromptsLibrary', () => {
  it('lista todos os prompts e mostra a contagem por categoria', async () => {
    await renderLib();
    // títulos aparecem (lista + possivelmente o detalhe do selecionado)
    expect(screen.getAllByText('Sourcing Global').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Matriz de Kraljic').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Negociar preço').length).toBeGreaterThan(0);
    // sidebar: Sourcing tem 2, Estratégia tem 1
    expect(screen.getByRole('button', { name: /Sourcing\s*2/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Estratégia\s*1/ })).toBeTruthy();
  });

  it('filtra por categoria', async () => {
    const user = userEvent.setup();
    await renderLib();
    await user.click(screen.getByRole('button', { name: /Estratégia\s*1/ }));
    expect(screen.getAllByText('Matriz de Kraljic').length).toBeGreaterThan(0);
    expect(screen.queryByText('Negociar preço')).toBeNull();
  });

  it('busca por texto filtra a lista', async () => {
    const user = userEvent.setup();
    await renderLib();
    await user.type(screen.getByLabelText('Buscar prompts'), 'kraljic');
    expect(screen.getAllByText('Matriz de Kraljic').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sourcing Global')).toBeNull();
  });

  it('abrir um prompt e "Usar no chat" guarda no sessionStorage e navega pro /chat', async () => {
    const user = userEvent.setup();
    await renderLib();
    // abre o leitor (modal) clicando na linha do prompt
    await user.click(screen.getByRole('button', { name: /Sourcing Global/ }));
    const useBtn = await screen.findByRole('button', { name: /Usar no chat/ });
    await user.click(useBtn);
    expect(window.sessionStorage.getItem('progpt_chat_prefill')).toBe(
      'Conteúdo do prompt 1 com [categoria].',
    );
    expect(pushSpy).toHaveBeenCalledWith('/chat');
  });

  it('favoritar um prompt incrementa a contagem de Favoritos', async () => {
    const user = userEvent.setup();
    await renderLib([]);
    expect(screen.getByRole('button', { name: /Favoritos\s*0/ })).toBeTruthy();
    // várias estrelas "Favoritar" (lista + detalhe) — clica a primeira
    await user.click(screen.getAllByRole('button', { name: 'Favoritar' })[0]!);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Favoritos\s*1/ })).toBeTruthy(),
    );
  });
});
