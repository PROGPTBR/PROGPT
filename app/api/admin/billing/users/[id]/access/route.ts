import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin, NotAuthenticated } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sub-projeto 36 — liberar/bloquear acesso de um usuário manualmente.
//  release → status 'active' (acesso concedido pelo admin, sem cobrança)
//  block   → status 'expired' (bloqueia o bot/assistentes)
const Body = z.object({ action: z.enum(['release', 'block']) });

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof NotAuthenticated)
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (e instanceof NotAdmin)
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    throw e;
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const svc = getServerSupabase();
  const now = new Date().toISOString();
  const status = body.action === 'release' ? 'active' : 'expired';

  const { error } = await svc
    .from('subscriptions')
    .upsert(
      { user_id: params.id, status, plan: 'pro', updated_at: now },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[admin/billing/access] upsert failed:', error.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status });
}
