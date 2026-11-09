import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupList({
  existing,
  insertOk = true,
}: {
  existing: unknown[];
  insertOk?: boolean;
}) {
  const insert = vi.fn().mockReturnValue({
    select: () => ({
      single: vi.fn().mockResolvedValue(
        insertOk
          ? {
              data: {
                id: 'new-tpl',
                assistant_type: 'diagnostico_aquisicao',
                name: 'Template padrão',
                description: 'x',
                body_md: '# t',
                created_by: null,
                created_at: '',
                updated_at: '',
              },
              error: null,
            }
          : { data: null, error: { message: 'fail' } },
      ),
    }),
  });
  const orderThenable = {
    eq: vi.fn().mockResolvedValue({ data: existing, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
      resolve({ data: existing, error: null }),
  };
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({
        select: () => ({ order: () => orderThenable }),
        insert,
      }),
    }),
  }));
  return { insert };
}

describe('listTemplates diagnostico_aquisicao', () => {
  it('não recria o padrão quando já existe template', async () => {
    const { insert } = setupList({
      existing: [{ id: 'already', assistant_type: 'diagnostico_aquisicao' }],
    });
    const { listTemplates } = await import('@/lib/assistants/templates');
    const rows = await listTemplates('diagnostico_aquisicao');
    expect(rows).toHaveLength(1);
    expect(insert).not.toHaveBeenCalled();
  });

  it('semeia o template padrão quando a lista vem vazia', async () => {
    const { insert } = setupList({ existing: [] });
    const { listTemplates } = await import('@/lib/assistants/templates');
    const rows = await listTemplates('diagnostico_aquisicao');
    expect(insert).toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('new-tpl');
  });
});
