// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

beforeEach(() => {
  vi.resetModules();
  vi.doMock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  }));
});
afterEach(() => cleanup());

const sampleUsers = [
  { id: 'u1', email: 'admin@example.com', role: 'admin' as const, last_sign_in_at: '2026-05-03T10:00:00Z', session_count: 12, created_at: '2026-04-01T10:00:00Z', active: true },
  { id: 'u2', email: 'user@example.com', role: 'user' as const, last_sign_in_at: '2026-05-02T08:00:00Z', session_count: 3, created_at: '2026-04-15T10:00:00Z', active: true },
  { id: 'u3', email: 'pending@example.com', role: 'user' as const, last_sign_in_at: null, session_count: 0, created_at: '2026-05-03T11:00:00Z', active: true },
];

describe('UsersTable', () => {
  it('renders one row per user with email and a role pill', async () => {
    const { UsersTable } = await import('@/components/admin/UsersTable');
    render(<UsersTable users={sampleUsers} currentUserId="u1" />);
    expect(screen.getByText('admin@example.com')).toBeTruthy();
    expect(screen.getByText('user@example.com')).toBeTruthy();
    expect(screen.getByText('pending@example.com')).toBeTruthy();
    expect(screen.getAllByText(/admin/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/convite enviado/i)).toBeTruthy();
  });

  it('row menu opens and reveals Promote action for a non-admin user', async () => {
    const { UsersTable } = await import('@/components/admin/UsersTable');
    render(<UsersTable users={sampleUsers} currentUserId="u1" />);
    const triggers = screen.getAllByRole('button', { name: /ações/i });
    // u2 is the second non-pending user row
    await userEvent.click(triggers[1]!);
    expect(await screen.findByText(/promover a admin/i)).toBeTruthy();
  });

  it('"+ Convidar usuário" button opens the InviteUserDialog', async () => {
    const { UsersTable } = await import('@/components/admin/UsersTable');
    render(<UsersTable users={sampleUsers} currentUserId="u1" />);
    await userEvent.click(screen.getByRole('button', { name: /convidar usuário/i }));
    expect(await screen.findByLabelText(/email/i)).toBeTruthy();
  });

  it('shows an "Inativo" badge for a deactivated user', async () => {
    const { UsersTable } = await import('@/components/admin/UsersTable');
    const users = [{ ...sampleUsers[1]!, active: false }];
    render(<UsersTable users={users} currentUserId="u1" />);
    expect(screen.getByText(/inativo/i)).toBeTruthy();
  });

  it('row menu offers "Desativar acesso" for an active user and "Enviar redefinição de senha"', async () => {
    const { UsersTable } = await import('@/components/admin/UsersTable');
    render(<UsersTable users={sampleUsers} currentUserId="u1" />);
    const triggers = screen.getAllByRole('button', { name: /ações/i });
    await userEvent.click(triggers[1]!);
    expect(await screen.findByText(/desativar acesso/i)).toBeTruthy();
    expect(screen.getByText(/enviar redefinição de senha/i)).toBeTruthy();
  });

  it('row menu offers "Ativar acesso" for a deactivated user, and no self-deactivate item on the current user row', async () => {
    const { UsersTable } = await import('@/components/admin/UsersTable');
    const users = [{ ...sampleUsers[0]!, active: false }, sampleUsers[1]!];
    render(<UsersTable users={users} currentUserId="u1" />);
    const triggers = screen.getAllByRole('button', { name: /ações/i });
    // u1 is the current user — no (de)activate item on its own row.
    await userEvent.click(triggers[0]!);
    expect(screen.queryByText(/ativar acesso/i)).toBeNull();
    expect(screen.queryByText(/desativar acesso/i)).toBeNull();
  });

  it('clicking "Desativar acesso" calls the toggle-active endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, active: false }), { status: 200 }),
    );
    const { UsersTable } = await import('@/components/admin/UsersTable');
    render(<UsersTable users={sampleUsers} currentUserId="u1" />);
    const triggers = screen.getAllByRole('button', { name: /ações/i });
    await userEvent.click(triggers[1]!);
    await userEvent.click(await screen.findByText(/desativar acesso/i));
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/admin/users/u2/toggle-active',
      expect.objectContaining({ method: 'POST' }),
    );
    const call = fetchSpy.mock.calls.find(([url]) => url === '/api/admin/users/u2/toggle-active');
    expect(JSON.parse((call?.[1]?.body as string) ?? '{}')).toEqual({ active: false });
    fetchSpy.mockRestore();
  });
});
