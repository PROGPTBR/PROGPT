// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { ThemesAdmin } from '@/components/admin/ThemesAdmin';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockThemes() {
  return [
    { theme: 'Kraljic', status: 'canonical', count: 5, inConstant: true },
    { theme: 'Outros', status: 'canonical', count: 0, inConstant: true },
    { theme: 'Gestão de Projetos', status: 'candidate', count: 3, inConstant: false },
    { theme: 'Cadeia de Suprimentos', status: 'candidate', count: 1, inConstant: false },
  ];
}

function mockFetchOk(body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
  return global.fetch as ReturnType<typeof vi.fn>;
}

describe('ThemesAdmin', () => {
  it('renders themes from the API with status badges and counts', async () => {
    mockFetchOk({ themes: mockThemes() });
    render(<ThemesAdmin />);
    // screen.getByText throws if missing — that's the assertion.
    await waitFor(() => screen.getByText('Kraljic'));
    screen.getByText('Gestão de Projetos');
    expect(screen.getAllByText('canônico').length).toBeGreaterThan(0);
    expect(screen.getAllByText('candidato').length).toBeGreaterThan(0);
  });

  it('shows totals in the header', async () => {
    mockFetchOk({ themes: mockThemes() });
    render(<ThemesAdmin />);
    // 2 canonical + 2 candidate + 9 articles + 1 empty canonical
    await waitFor(() =>
      screen.getByText(/2 canônicos.*2 candidatos.*9 artigos.*1 canônicos vazios/),
    );
  });

  it('shows the Promover button only on candidate rows', async () => {
    mockFetchOk({ themes: mockThemes() });
    render(<ThemesAdmin />);
    await waitFor(() => screen.getByText('Kraljic'));
    const promoteButtons = screen.getAllByRole('button', { name: /Promover/i });
    expect(promoteButtons).toHaveLength(2); // exactly the 2 candidate rows
  });

  it('hides Demover on canonical rows that live in CANONICAL_THEMES constant', async () => {
    mockFetchOk({ themes: mockThemes() });
    render(<ThemesAdmin />);
    await waitFor(() => screen.getByText('Kraljic'));
    expect(screen.queryByRole('button', { name: /Demover/i })).toBeNull();
  });

  it('opens the rename modal (free-text) when "Renomear" is clicked', async () => {
    mockFetchOk({ themes: mockThemes() });
    render(<ThemesAdmin />);
    await waitFor(() => screen.getByText('Gestão de Projetos'));
    const renameButtons = screen.getAllByRole('button', { name: /^Renomear$/i });
    fireEvent.click(renameButtons[0]!);
    await waitFor(() => screen.getByPlaceholderText(/Ex: Gestão da Cadeia/));
  });

  it('opens the merge modal with a dropdown when "Mesclar" is clicked', async () => {
    mockFetchOk({ themes: mockThemes() });
    render(<ThemesAdmin />);
    await waitFor(() => screen.getByText('Gestão de Projetos'));
    const mergeButtons = screen.getAllByRole('button', { name: /^Mesclar$/i });
    fireEvent.click(mergeButtons[0]!);
    await waitFor(() => screen.getByLabelText(/Tema de destino/i));
    // Dropdown is a <select>; verify the placeholder option exists
    expect(screen.getByText(/— escolha um tema —/)).toBeTruthy();
  });

  it('merge dropdown excludes the source theme and surfaces other rows as options', async () => {
    const themes = mockThemes();
    mockFetchOk({ themes });
    render(<ThemesAdmin />);
    await waitFor(() => screen.getByText('Gestão de Projetos'));
    // Click Mesclar on the FIRST row that supports it — that's Kraljic
    const mergeButtons = screen.getAllByRole('button', { name: /^Mesclar$/i });
    fireEvent.click(mergeButtons[0]!);
    await waitFor(() => screen.getByLabelText(/Tema de destino/i));
    // Source row's theme should NOT appear in the dropdown options
    const select = screen.getByLabelText(/Tema de destino/i) as HTMLSelectElement;
    const optionValues = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(optionValues).not.toContain('Kraljic'); // the source row clicked first
    // But other themes should
    expect(optionValues).toContain('Gestão de Projetos');
    expect(optionValues).toContain('Outros');
  });

  it('renders Mesclar button on every row with count > 0 (canonical and candidate)', async () => {
    mockFetchOk({ themes: mockThemes() });
    render(<ThemesAdmin />);
    await waitFor(() => screen.getByText('Gestão de Projetos'));
    // Kraljic (5), Gestão de Projetos (3), Cadeia de Suprimentos (1) — Outros has count=0
    const mergeButtons = screen.getAllByRole('button', { name: /^Mesclar$/i });
    expect(mergeButtons).toHaveLength(3);
  });
});
