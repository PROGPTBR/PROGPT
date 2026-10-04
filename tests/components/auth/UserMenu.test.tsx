// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => cleanup());

function mockBrowser(email: string | null, role = 'user') {
  const signOut = vi.fn().mockResolvedValue({ error: null });
  vi.doMock('@/lib/db/supabase-browser', () => ({
    supabaseBrowser: () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: email ? { id: 'u1', email } : null },
          error: null,
        }),
        signOut,
      },
      from: vi.fn().mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { role }, error: null }),
          }),
        }),
      }),
    }),
  }));
  const refresh = vi.fn();
  const push = vi.fn();
  vi.doMock('next/navigation', () => ({
    useRouter: () => ({ refresh, push }),
  }));
  return { signOut, refresh, push };
}

describe('UserMenu', () => {
  it('mostra só o ícone com a inicial — o e-mail não fica exposto na tela', async () => {
    mockBrowser('carlos@empresa.com');
    const { UserMenu } = await import('@/components/auth/UserMenu');
    render(<UserMenu />);
    const botao = await screen.findByRole('button', { name: 'Minha conta' });
    expect(botao.textContent).toBe('C');
    expect(botao.getAttribute('data-tour')).toBe('conta');
    expect(screen.queryByText('carlos@empresa.com')).toBeNull();
  });

  it('o e-mail aparece dentro do menu, com perfil e assinatura', async () => {
    mockBrowser('carlos@empresa.com');
    const { UserMenu } = await import('@/components/auth/UserMenu');
    render(<UserMenu />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Minha conta' }));
    expect(screen.getByText('carlos@empresa.com')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Meu perfil/ }).getAttribute('href')).toBe('/profile');
    expect(screen.getByRole('menuitem', { name: /Assinatura/ }).getAttribute('href')).toBe('/account/billing');
    expect(screen.queryByRole('menuitem', { name: /Admin/ })).toBeNull();
  });

  it('a equipe vê o atalho do Admin', async () => {
    mockBrowser('staff@2bsupply.com.br', 'gestor');
    const { UserMenu } = await import('@/components/auth/UserMenu');
    render(<UserMenu />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Minha conta' }));
    expect(await screen.findByRole('menuitem', { name: /Admin/ })).toBeTruthy();
  });

  it('Sair encerra a sessão e atualiza a tela', async () => {
    const { signOut, refresh } = mockBrowser('a@b.com');
    const { UserMenu } = await import('@/components/auth/UserMenu');
    render(<UserMenu />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Minha conta' }));
    await user.click(screen.getByRole('menuitem', { name: /sair/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(refresh).toHaveBeenCalled();
  });

  it('sem sessão não mostra nada', async () => {
    mockBrowser(null);
    const { UserMenu } = await import('@/components/auth/UserMenu');
    const { container } = render(<UserMenu />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe('');
  });
});
