// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Leaf children pull in supabase/next — stub them so the test isolates the
// sidebar's own rename interaction.
vi.mock('@/components/auth/UserRow', () => ({ UserRow: () => null }));
vi.mock('@/components/brand/BrandLogo', () => ({ BrandLogo: () => null }));

import { Sidebar } from '@/components/chat/Sidebar';
import type { StoredSession } from '@/lib/chat-storage';

afterEach(() => cleanup());

const sessions: StoredSession[] = [
  { id: 'a', title: 'Conversa A', messages: [], updatedAt: Date.now() },
  { id: 'b', title: 'Conversa B', messages: [], updatedAt: Date.now() - 60_000 },
];

function renderSidebar(overrides?: Partial<React.ComponentProps<typeof Sidebar>>) {
  const props = {
    sessions,
    currentId: 'a',
    onSwitch: vi.fn(),
    onNew: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    ...overrides,
  };
  return { ...render(<Sidebar {...props} />), props };
}

describe('Sidebar rename', () => {
  it('shows a pencil (rename) button per conversation', () => {
    renderSidebar();
    expect(
      screen.getByRole('button', { name: /renomear conversa conversa a/i }),
    ).toBeTruthy();
  });

  it('clicking the pencil opens an input prefilled with the title; Enter commits the new name', async () => {
    const user = userEvent.setup();
    const { props } = renderSidebar();
    await user.click(
      screen.getByRole('button', { name: /renomear conversa conversa a/i }),
    );
    const input = screen.getByRole('textbox', { name: /novo nome da conversa/i });
    expect((input as HTMLInputElement).value).toBe('Conversa A');
    await user.clear(input);
    await user.type(input, 'Plano de TI{Enter}');
    expect(props.onRename).toHaveBeenCalledWith('a', 'Plano de TI');
  });

  it('Escape cancels without renaming', async () => {
    const user = userEvent.setup();
    const { props } = renderSidebar();
    await user.click(
      screen.getByRole('button', { name: /renomear conversa conversa a/i }),
    );
    const input = screen.getByRole('textbox', { name: /novo nome da conversa/i });
    await user.type(input, 'Algo{Escape}');
    expect(props.onRename).not.toHaveBeenCalled();
    // input is gone, title is back
    expect(screen.queryByRole('textbox', { name: /novo nome da conversa/i })).toBeNull();
  });

  it('starting a rename does not trigger onSwitch', async () => {
    const user = userEvent.setup();
    const { props } = renderSidebar();
    await user.click(
      screen.getByRole('button', { name: /renomear conversa conversa b/i }),
    );
    expect(props.onSwitch).not.toHaveBeenCalled();
  });

  it('does not render a pencil when onRename is not provided', () => {
    renderSidebar({ onRename: undefined });
    expect(
      screen.queryByRole('button', { name: /renomear conversa/i }),
    ).toBeNull();
  });
});
