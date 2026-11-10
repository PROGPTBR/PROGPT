import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setup(admin = true) {
  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error {}
    return {
      NotAdmin,
      requireAdmin: vi.fn().mockImplementation(() => {
        if (!admin) throw new NotAdmin();
        return { user: { id: 'admin-id' } };
      }),
    };
  });
  vi.doMock('@/lib/email/preview', () => ({
    buildEmailPreview: vi.fn().mockReturnValue({
      subject: 'Novidade no PROGPT: Título',
      html: '<html>preview</html>',
    }),
  }));
}

function request(body: unknown) {
  return new Request('http://localhost/api/admin/updates/email-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/updates/email-preview', () => {
  it('oculta a rota para quem não é admin', async () => {
    setup(false);
    const { POST } = await import('@/app/api/admin/updates/email-preview/route');
    expect((await POST(request({}))).status).toBe(404);
  });

  it('valida o conteúdo da prévia', async () => {
    setup();
    const { POST } = await import('@/app/api/admin/updates/email-preview/route');
    expect((await POST(request({ template: 'inexistente', update: {} }))).status).toBe(400);
  });

  it('retorna HTML sem cache e não chama nenhum envio', async () => {
    setup();
    const preview = await import('@/lib/email/preview');
    const { POST } = await import('@/app/api/admin/updates/email-preview/route');
    const response = await POST(request({
      template: 'update',
      update: { title: 'Título', summary: 'Resumo', slug: 'titulo', category: 'fix' },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({
      subject: 'Novidade no PROGPT: Título',
      html: '<html>preview</html>',
    });
    expect(preview.buildEmailPreview).toHaveBeenCalledWith('update', {
      title: 'Título',
      summary: 'Resumo',
      slug: 'titulo',
      category: 'fix',
    });
  });
});
