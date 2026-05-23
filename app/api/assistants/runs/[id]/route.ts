import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';

// DELETE /api/assistants/runs/[id]
// Remove um run salvo do usuário. Owner-gated: filtra por user_id no
// próprio UPDATE/DELETE pra defesa em profundidade (assistant_runs tem
// RLS por owner, mas service-role bypass exige checar no código).

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = getServerSupabase();
  const { error, count } = await sb
    .from('assistant_runs')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) {
    console.warn('[api/assistants/runs/delete] failed:', error.message);
    return NextResponse.json(
      { error: 'delete_failed', message: error.message },
      { status: 500 },
    );
  }

  if (!count || count === 0) {
    // 404 (não 403) — não revela existência de run de outro usuário.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
