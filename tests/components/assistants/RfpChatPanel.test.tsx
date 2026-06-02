// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RfpChatPanel } from '@/components/assistants/RfpChatPanel';

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView (the panel auto-scrolls on update).
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RfpChatPanel — persisted refine hydration (item 6)', () => {
  it('hydrates the saved refine conversation on mount', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).endsWith('/refine-messages')) {
        return {
          ok: true,
          json: async () => ({
            messages: [
              { role: 'user', content: 'pergunta salva' },
              { role: 'assistant', content: 'resposta salva' },
            ],
          }),
        } as unknown as Response;
      }
      return { ok: false, json: async () => ({}) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RfpChatPanel runId="r1" />);

    expect(await screen.findByText('pergunta salva')).toBeTruthy();
    expect(await screen.findByText(/resposta salva/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/assistants/runs/r1/refine-messages');
  });

  it('starts empty (shows suggestions) when there is no saved history', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ messages: [] }) }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    render(<RfpChatPanel runId="r2" />);
    // suggestion chips render only when messages.length === 0
    expect(await screen.findByText(/Sugestões para começar/i)).toBeTruthy();
  });
});
