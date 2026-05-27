import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockSupabase(counts: { sessions: number; assistantRuns: number; feedback: number }) {
  const tableMap: Record<string, number> = {
    sessions: counts.sessions,
    assistant_runs: counts.assistantRuns,
    message_feedback: counts.feedback,
  };
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: (table: string) => ({
        select: () => ({
          eq: () => Promise.resolve({ count: tableMap[table] ?? 0, error: null }),
        }),
      }),
    }),
  }));
}

describe('getAccountFootprint', () => {
  it('aggregates counts from all 3 tables', async () => {
    mockSupabase({ sessions: 5, assistantRuns: 3, feedback: 7 });
    const { getAccountFootprint } = await import('@/lib/account');
    const fp = await getAccountFootprint('user-x');
    expect(fp).toEqual({ sessions: 5, assistantRuns: 3, feedback: 7 });
  });

  it('returns zeros when user has no data', async () => {
    mockSupabase({ sessions: 0, assistantRuns: 0, feedback: 0 });
    const { getAccountFootprint } = await import('@/lib/account');
    const fp = await getAccountFootprint('empty-user');
    expect(fp).toEqual({ sessions: 0, assistantRuns: 0, feedback: 0 });
  });
});
