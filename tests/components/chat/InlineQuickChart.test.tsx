// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineQuickChart } from '@/components/chat/InlineQuickChart';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    }),
  );
}

describe('InlineQuickChart', () => {
  it('shows the "Gerar gráfico" prompt before generating', () => {
    render(<InlineQuickChart sourceText="Fornecedor\tGasto\nACME\t100" />);
    expect(screen.getByRole('button', { name: /gerar gráfico/i })).toBeTruthy();
  });

  it('renders the PNG + download button on success', async () => {
    mockFetchOnce(200, {
      pngBase64: 'ZmFrZS1wbmc=',
      spec: { chartType: 'bar', categoryColumn: 'Fornecedor', valueColumn: 'Gasto', title: 'Gasto por fornecedor' },
      warnings: [],
      rowsUsed: 2,
    });
    render(<InlineQuickChart sourceText="Fornecedor\tGasto\nACME\t100" />);
    await userEvent.click(screen.getByRole('button', { name: /gerar gráfico/i }));

    await waitFor(() => expect(screen.getByRole('img')).toBeTruthy());
    expect(screen.getByText('Gasto por fornecedor')).toBeTruthy();
    expect(screen.getByRole('button', { name: /baixar png/i })).toBeTruthy();
  });

  it('shows a friendly error + retry + fallback link when the message has no plottable table', async () => {
    mockFetchOnce(400, { error: 'no_series', warnings: [] });
    render(<InlineQuickChart sourceText="só um textão sem tabela" />);
    await userEvent.click(screen.getByRole('button', { name: /gerar gráfico/i }));

    await waitFor(() =>
      expect(screen.getByText(/não encontrei categoria \+ valor numérico válidos/i)).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeTruthy();
    const fallback = screen.getByRole('link', { name: /abrir a ferramenta completa/i });
    expect(fallback.getAttribute('href')).toBe('/assistants/graficos');
  });

  it('surfaces the rate-limit retry-after message on 429', async () => {
    mockFetchOnce(429, { retry_after_secs: 12 });
    render(<InlineQuickChart sourceText="Fornecedor\tGasto\nACME\t100" />);
    await userEvent.click(screen.getByRole('button', { name: /gerar gráfico/i }));
    await waitFor(() => expect(screen.getByText(/12s/)).toBeTruthy());
  });
});
