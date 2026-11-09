// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const toastError = vi.fn();
const toastInfo = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
    success: vi.fn(),
  },
}));

beforeEach(() => {
  toastError.mockReset();
  toastInfo.mockReset();
});
afterEach(() => cleanup());

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe('EnvioNota dropzone', () => {
  it('arrastar um XML envia o arquivo sem abrir o seletor', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nota: { numero: '123', finalidade: 'unica' } }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const onEnviada = vi.fn();
    const { EnvioNota } = await import('@/components/recebimento/ui');
    render(<EnvioNota endpoint="/api/recebimento/pedidos/p1/notas" onEnviada={onEnviada} />);

    const xml = makeFile('nfe.xml', 'application/xml');
    fireEvent.drop(screen.getByTestId('envio-nota-dropzone'), { dataTransfer: { files: [xml], types: ['Files'] } });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/recebimento/pedidos/p1/notas');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBe(xml);
    await waitFor(() => expect(onEnviada).toHaveBeenCalledWith({ numero: '123', finalidade: 'unica' }));
  });

  it('recusa tipo que não é nota e não chama a API', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { EnvioNota } = await import('@/components/recebimento/ui');
    render(<EnvioNota endpoint="/api/x" onEnviada={() => {}} />);

    fireEvent.drop(screen.getByTestId('envio-nota-dropzone'), {
      dataTransfer: { files: [makeFile('planilha.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')], types: ['Files'] },
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
