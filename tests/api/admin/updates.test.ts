import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

function setup({ admin = true, createError }: { admin?: boolean; createError?: unknown } = {}) {
  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error {}
    return {
      NotAdmin,
      requireAdmin: vi.fn().mockImplementation(() => {
        if (!admin) throw new NotAdmin();
        return { user: { id: 'admin-id' }, profile: { role: 'admin' } };
      }),
    };
  });
  vi.doMock('@/lib/updates/queries', () => ({
    PRODUCT_UPDATES_CACHE_TAG: 'product-updates',
    listAdminUpdates: vi.fn().mockResolvedValue([]),
    createProductUpdate: createError
      ? vi.fn().mockRejectedValue(createError)
      : vi.fn().mockResolvedValue({ id: 'update-id' }),
  }));
  vi.doMock('next/cache', () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
  }));
}

const valid = {
  title: 'Melhoria na busca',
  slug: 'melhoria-na-busca',
  category: 'improvement',
  summary: 'A busca ficou mais rápida.',
  content_md: '**Detalhes**',
  image_url: null,
  video_url: null,
  media_caption: null,
  published_at: '2026-11-10T15:00:00.000Z',
  status: 'published',
};

function post(body: unknown) {
  return new Request('http://localhost/api/admin/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/admin/updates', () => {
  it('oculta a rota de quem não é admin', async () => {
    setup({ admin: false });
    const { GET } = await import('@/app/api/admin/updates/route');
    expect((await GET()).status).toBe(404);
  });

  it('rejeita payload inválido', async () => {
    setup();
    const { POST } = await import('@/app/api/admin/updates/route');
    expect((await POST(post({ title: '' }))).status).toBe(400);
  });

  it('cria e invalida a representação pública', async () => {
    setup();
    const cache = await import('next/cache');
    const { POST } = await import('@/app/api/admin/updates/route');
    expect((await POST(post(valid))).status).toBe(201);
    expect(cache.revalidateTag).toHaveBeenCalledWith('product-updates');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/atualizacoes');
  });

  it('retorna conflito para slug duplicado', async () => {
    setup({ createError: { code: '23505' } });
    const { POST } = await import('@/app/api/admin/updates/route');
    const response = await POST(post(valid));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'slug_conflict' });
  });
});
