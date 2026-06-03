import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(role: 'admin' | 'user') {
  vi.doMock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>();
    return {
      ...actual,
      requireAdmin: vi.fn().mockImplementation(async () => {
        if (role !== 'admin') throw new actual.NotAdmin();
        return {
          user: { id: 'admin-1', email: 'a@b.com' } as unknown,
          profile: { id: 'admin-1', role: 'admin', display_name: null },
        };
      }),
    };
  });
}

// Captura o último update/insert passado ao supabase service-role.
function mockSupabase(opts: { error?: boolean; insertId?: string } = {}) {
  const calls: { updates: unknown[]; inserts: unknown[] } = { updates: [], inserts: [] };
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => {
        const builder: Record<string, unknown> = {};
        builder.update = vi.fn().mockImplementation((p: unknown) => {
          calls.updates.push(p);
          return builder;
        });
        builder.delete = vi.fn().mockReturnValue(builder);
        builder.eq = vi.fn().mockResolvedValue({ error: opts.error ? { message: 'x' } : null });
        builder.insert = vi.fn().mockImplementation((p: unknown) => {
          calls.inserts.push(p);
          return builder;
        });
        builder.select = vi.fn().mockReturnValue(builder);
        builder.single = vi.fn().mockResolvedValue({
          data: opts.error ? null : { id: opts.insertId ?? 'new-id' },
          error: opts.error ? { message: 'x' } : null,
        });
        builder.order = vi.fn().mockReturnValue(builder);
        return builder;
      },
    }),
  }));
  return calls;
}

const ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function patchReq(body: unknown) {
  return new Request(`http://localhost/api/admin/prompts/${ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/admin/prompts/[id]', () => {
  it('non-admin → 404', async () => {
    mockAuth('user');
    const { PATCH } = await import('@/app/api/admin/prompts/[id]/route');
    const res = await PATCH(patchReq({ title: 'Novo título válido' }), { params: { id: ID } });
    expect(res.status).toBe(404);
  });

  it('empty body → 400', async () => {
    mockAuth('admin');
    mockSupabase();
    const { PATCH } = await import('@/app/api/admin/prompts/[id]/route');
    const res = await PATCH(patchReq({}), { params: { id: ID } });
    expect(res.status).toBe(400);
  });

  it('title too short → 400', async () => {
    mockAuth('admin');
    mockSupabase();
    const { PATCH } = await import('@/app/api/admin/prompts/[id]/route');
    const res = await PATCH(patchReq({ title: 'ab' }), { params: { id: ID } });
    expect(res.status).toBe(400);
  });

  it('admin + valid patch → 200 and update carries the fields + updated_at', async () => {
    mockAuth('admin');
    const calls = mockSupabase();
    const { PATCH } = await import('@/app/api/admin/prompts/[id]/route');
    const res = await PATCH(
      patchReq({ category: 'Negociação', is_published: false }),
      { params: { id: ID } },
    );
    expect(res.status).toBe(200);
    const u = calls.updates[0] as Record<string, unknown>;
    expect(u.category).toBe('Negociação');
    expect(u.is_published).toBe(false);
    expect(typeof u.updated_at).toBe('string');
  });

  it('supabase error → 500', async () => {
    mockAuth('admin');
    mockSupabase({ error: true });
    const { PATCH } = await import('@/app/api/admin/prompts/[id]/route');
    const res = await PATCH(patchReq({ title: 'Título válido aqui' }), { params: { id: ID } });
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/prompts', () => {
  function postReq(body: unknown) {
    return new Request('http://localhost/api/admin/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('non-admin → 404', async () => {
    mockAuth('user');
    const { POST } = await import('@/app/api/admin/prompts/route');
    const res = await POST(postReq({ title: 'Prompt válido', content: 'corpo' }));
    expect(res.status).toBe(404);
  });

  it('missing content → 400', async () => {
    mockAuth('admin');
    mockSupabase();
    const { POST } = await import('@/app/api/admin/prompts/route');
    const res = await POST(postReq({ title: 'Prompt válido' }));
    expect(res.status).toBe(400);
  });

  it('admin + valid → 201 with id; insert carries source=admin', async () => {
    mockAuth('admin');
    const calls = mockSupabase({ insertId: 'pp-9' });
    const { POST } = await import('@/app/api/admin/prompts/route');
    const res = await POST(
      postReq({ title: 'Prompt de teste', content: 'Você é um especialista...' }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe('pp-9');
    const ins = calls.inserts[0] as Record<string, unknown>;
    expect(ins.source).toBe('admin');
    expect(ins.is_published).toBe(true); // default
  });
});
