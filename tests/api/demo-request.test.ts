import { beforeEach, describe, expect, it, vi } from 'vitest';

const validBody = {
  name: 'Maria Compradora',
  email: 'maria@empresa.com.br',
  whatsapp: '(21) 99999-9999',
  company: 'Empresa Exemplo',
  role: 'Gerente de Compras',
  message: 'Quero conhecer o fluxo completo.',
  solution: 'RFI/RFQ',
  website: '',
};

function request(body: unknown): Request {
  return new Request('http://localhost/api/demo-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetModules();
});

describe('POST /api/demo-request', () => {
  it('rejeita campos inválidos no servidor', async () => {
    vi.doMock('@/lib/email/client', () => ({
      getEmailConfigStatus: () => ({ hasKey: true }),
      sendEmail: vi.fn(),
    }));
    const { POST } = await import('@/app/api/demo-request/route');
    const response = await POST(request({ ...validBody, email: 'invalido' }));
    expect(response.status).toBe(400);
  });

  it('não simula sucesso quando o SMTP não está configurado', async () => {
    vi.doMock('@/lib/email/client', () => ({
      getEmailConfigStatus: () => ({ hasKey: false }),
      sendEmail: vi.fn(),
    }));
    const { POST } = await import('@/app/api/demo-request/route');
    const response = await POST(request(validBody));
    expect(response.status).toBe(503);
  });

  it('inclui a solução selecionada e só confirma após o envio real', async () => {
    const sendEmail = vi.fn().mockResolvedValue({ ok: true, id: 'smtp-message-id' });
    vi.doMock('@/lib/email/client', () => ({
      getEmailConfigStatus: () => ({ hasKey: true }),
      sendEmail,
    }));
    const { POST } = await import('@/app/api/demo-request/route');
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({
      to: 'comercial@2bsupply.com.br',
      subject: 'Agendamento de demonstração - RFI/RFQ',
    });
    expect(sendEmail.mock.calls[0]?.[0].html).toContain('RFI/RFQ');
  });

  it('retorna erro quando o provedor não aceita a mensagem', async () => {
    vi.doMock('@/lib/email/client', () => ({
      getEmailConfigStatus: () => ({ hasKey: true }),
      sendEmail: vi.fn().mockResolvedValue({ ok: false, error: 'smtp failed' }),
    }));
    const { POST } = await import('@/app/api/demo-request/route');
    const response = await POST(request(validBody));
    expect(response.status).toBe(502);
  });
});
