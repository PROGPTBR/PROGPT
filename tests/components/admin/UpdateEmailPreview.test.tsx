// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdateEmailPreview } from '@/components/admin/UpdateEmailPreview';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UpdateEmailPreview', () => {
  it('mostra o HTML gerado e alterna entre desktop e celular', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subject: 'Novidade no PROGPT: Busca',
        html: '<html><body>Prévia</body></html>',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <UpdateEmailPreview
        title="Busca"
        summary="Resumo"
        slug="busca"
        category="improvement"
      />,
    );

    expect(screen.getByRole('button', { name: /desktop/i }).getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(screen.getByText('Novidade no PROGPT: Busca')).toBeTruthy());
    expect(screen.getByTitle('Prévia do e-mail em desktop')).toBeTruthy();
    expect(screen.getByLabelText('Template')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /celular/i }));
    expect(screen.getByRole('button', { name: /celular/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTitle('Prévia do e-mail em celular')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/updates/email-preview',
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    );

    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'welcome' } });
    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1);
      const request = JSON.parse(String(lastCall?.[1]?.body));
      expect(request.template).toBe('welcome');
      expect(request.update).toEqual({
        title: 'Busca',
        summary: 'Resumo',
        slug: 'busca',
        category: 'improvement',
      });
    });
  });
});
