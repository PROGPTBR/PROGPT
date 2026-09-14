import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const body = await req.json();
    parsed = bodySchema.parse(body);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { ids } = parsed;
  const sb = getServerSupabase();
  const { error, count } = await sb
    .from('articles')
    .delete({ count: 'exact' })
    .in('id', ids);

  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  void recordAuditLog({
    actorId: admin.user.id,
    actorEmail: admin.user.email,
    action: 'article.bulk_delete',
    resourceType: 'article',
    metadata: { ids, deleted: count ?? ids.length },
  });
  return NextResponse.json({ ok: true, deleted: count ?? ids.length });
}
