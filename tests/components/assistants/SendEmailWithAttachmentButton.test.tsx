// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  SendEmailWithAttachmentButton,
  splitRecipients,
} from '@/components/assistants/SendEmailWithAttachmentButton';

// Backlog do diretor (2026-08-19, Batch I) — botão "Abrir e-mail com a RFQ
// anexada". Baixa o .eml montado no servidor (com o .docx dentro).

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

let anchorClick: ReturnType<typeof vi.fn>;

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  anchorClick = vi.fn();
  HTMLAnchorElement.prototype.click = anchorClick;
  // jsdom não implementa as APIs de blob URL usadas no download.
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:fake'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockFetchOk() {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    blob: async () => new Blob(['eml']),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('splitRecipients', () => {
  it('accepts comma- and semicolon-separated addresses', () => {
    expect(splitRecipients('a@x.com, b@y.com; c@z.com').valid).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
    ]);
  });

  it('separates malformed entries instead of silently dropping them', () => {
    const { valid, invalid } = splitRecipients('ok@x.com, sem-arroba');
    expect(valid).toEqual(['ok@x.com']);
    expect(invalid).toEqual(['sem-arroba']);
  });

  it('ignores blank segments', () => {
    expect(splitRecipients(' , ;  ')).toEqual({ valid: [], invalid: [] });
  });
});

describe('SendEmailWithAttachmentButton', () => {
  it('fetches the run .eml without a ?to when no recipient was typed', async () => {
    const fetchMock = mockFetchOk();
    render(<SendEmailWithAttachmentButton runId="run-1234abcd" />);

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/assistants/runs/run-1234abcd/eml'),
    );
    expect(anchorClick).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('passes the typed recipients through ?to', async () => {
    const fetchMock = mockFetchOk();
    render(<SendEmailWithAttachmentButton runId="run-1234abcd" />);

    await userEvent.type(
      screen.getByLabelText('E-mails dos fornecedores'),
      'a@x.com, b@y.com',
    );
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/assistants/runs/run-1234abcd/eml?to=a%40x.com%2Cb%40y.com',
      ),
    );
  });

  it('refuses to build the message when an address is malformed', async () => {
    const fetchMock = mockFetchOk();
    render(<SendEmailWithAttachmentButton runId="run-1234abcd" />);

    await userEvent.type(
      screen.getByLabelText('E-mails dos fornecedores'),
      'fornecedor.com',
    );
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a server failure instead of downloading an empty file', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<SendEmailWithAttachmentButton runId="run-1234abcd" />);

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it('is disabled while the run has no id yet (still generating)', () => {
    render(<SendEmailWithAttachmentButton runId={null} />);
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
  });
});
