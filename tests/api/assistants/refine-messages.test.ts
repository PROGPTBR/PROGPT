// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => vi.resetModules());

describe('updateRunRefineMessages', () => {
  function mockSupabase(opts: { error?: { message: string } | null }) {
    const updates: Array<Record<string, unknown>> = [];
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => ({
          update: (payload: Record<string, unknown>) => {
            updates.push(payload);
            return { eq: async () => ({ error: opts.error ?? null }) };
          },
        }),
      }),
    }));
    return { updates };
  }

  it('writes refine_messages and returns true', async () => {
    const m = mockSupabase({});
    const { updateRunRefineMessages } = await import('@/lib/assistants/runs');
    const msgs = [
      { role: 'user' as const, content: 'a' },
      { role: 'assistant' as const, content: 'b', ts: '2026-06-02T10:00:00Z' },
    ];
    const ok = await updateRunRefineMessages('r1', msgs);
    expect(ok).toBe(true);
    expect(m.updates[0]!.refine_messages).toEqual(msgs);
  });

  it('returns false on db error without throwing', async () => {
    mockSupabase({ error: { message: 'boom' } });
    const { updateRunRefineMessages } = await import('@/lib/assistants/runs');
    await expect(updateRunRefineMessages('r1', [])).resolves.toBe(false);
  });
});

describe('GET /api/assistants/runs/[id]/refine-messages', () => {
  function mock(user: { id: string } | null, run: unknown) {
    vi.doMock('@/lib/auth', () => ({ getCurrentUser: async () => user }));
    vi.doMock('@/lib/assistants/runs', () => ({ getRunForOwner: async () => run }));
  }
  const req = new Request('http://x/api/assistants/runs/r1/refine-messages');

  it('401 without a user', async () => {
    mock(null, null);
    const { GET } = await import('@/app/api/assistants/runs/[id]/refine-messages/route');
    const res = await GET(req, { params: { id: 'r1' } });
    expect(res.status).toBe(401);
  });

  it('404 when the run is not owned', async () => {
    mock({ id: 'u1' }, null);
    const { GET } = await import('@/app/api/assistants/runs/[id]/refine-messages/route');
    const res = await GET(req, { params: { id: 'r1' } });
    expect(res.status).toBe(404);
  });

  it('200 with the persisted messages', async () => {
    const messages = [
      { role: 'user', content: 'pergunta' },
      { role: 'assistant', content: 'resposta' },
    ];
    mock({ id: 'u1' }, { refine_messages: messages });
    const { GET } = await import('@/app/api/assistants/runs/[id]/refine-messages/route');
    const res = await GET(req, { params: { id: 'r1' } });
    expect(res.status).toBe(200);
    expect((await res.json()).messages).toEqual(messages);
  });

  it('200 with [] when refine_messages is null', async () => {
    mock({ id: 'u1' }, { refine_messages: null });
    const { GET } = await import('@/app/api/assistants/runs/[id]/refine-messages/route');
    const res = await GET(req, { params: { id: 'r1' } });
    expect(res.status).toBe(200);
    expect((await res.json()).messages).toEqual([]);
  });
});
