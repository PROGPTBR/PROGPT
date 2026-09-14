import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

describe('recordAuditLog', () => {
  it('inserts a row with actor/action/resource/metadata', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ insert }) }),
    }));
    const { recordAuditLog } = await import('@/lib/observability/audit-log');
    await recordAuditLog({
      actorId: 'admin-1',
      actorEmail: 'admin@x.com',
      action: 'article.delete',
      resourceType: 'article',
      resourceId: 'art-1',
      metadata: { title: 'Kraljic 1983' },
    });
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0]![0];
    expect(row.actor_id).toBe('admin-1');
    expect(row.actor_email).toBe('admin@x.com');
    expect(row.action).toBe('article.delete');
    expect(row.resource_type).toBe('article');
    expect(row.resource_id).toBe('art-1');
    expect(row.metadata).toEqual({ title: 'Kraljic 1983' });
  });

  it('defaults optional fields to null/empty object', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ insert }) }),
    }));
    const { recordAuditLog } = await import('@/lib/observability/audit-log');
    await recordAuditLog({ actorId: 'admin-1', action: 'user.role_change' });
    const row = insert.mock.calls[0]![0];
    expect(row.actor_email).toBeNull();
    expect(row.resource_type).toBeNull();
    expect(row.resource_id).toBeNull();
    expect(row.metadata).toEqual({});
  });

  it('swallows errors so audit-log failures never break the admin action', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({ from: () => ({ insert }) }),
    }));
    const { recordAuditLog } = await import('@/lib/observability/audit-log');
    await expect(
      recordAuditLog({ actorId: 'admin-1', action: 'article.delete' }),
    ).resolves.toBeUndefined();
  });

  it('swallows throws (network errors etc.) from supabase', async () => {
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => {
        throw new Error('connection refused');
      },
    }));
    const { recordAuditLog } = await import('@/lib/observability/audit-log');
    await expect(
      recordAuditLog({ actorId: 'admin-1', action: 'article.delete' }),
    ).resolves.toBeUndefined();
  });
});
